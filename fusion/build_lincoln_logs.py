# Builds every part from parts.mjs as an editable, parametric Autodesk Fusion design.
#
# Run it from Fusion: Utilities > Add-Ins > Scripts and Add-Ins > "+" > pick this folder > Run.
# It opens a new design, creates the user parameters, then one component per part.
# Set PART_SET below to 'rounded' to build the rounded-end log set (stl/rounded_woodgrain/) instead.
#
# How the design is organised (see fusion/README.md for the full parameter list):
#   - Shared sizes (LogDia, NotchDepth, NotchCenters, Clearance, PrintFlat ...) are user parameters.
#   - Each part has its own parameters, prefixed with a short code (L3_Length, L3_Notches ...).
#   - Every sketch dimension and feature distance is an expression of those parameters.
#   - Each body is modelled in its printing orientation, sitting on Z = 0.
import adsk.core
import adsk.fusion
import traceback

PART_SET = 'standard'  # 'standard': every part (DeadPresidentTreeSections.f3d); 'rounded': the rounded-end logs only

P3 = adsk.core.Point3D.create
VI = adsk.core.ValueInput.createByString
NEW = adsk.fusion.FeatureOperations.NewBodyFeatureOperation
CUT = adsk.fusion.FeatureOperations.CutFeatureOperation

# (name, expression, units, comment). Order matters: a parameter can only use ones above it.
SHARED = [
    ('LogDia', '0.75 in', 'mm', 'Log diameter'),
    ('NotchDepth', '0.1875 in', 'mm', 'Notch depth, each side of a log'),
    ('NotchCenters', '3 in', 'mm', 'Spacing between notch centres'),
    ('Clearance', '0.2 mm', 'mm', 'Fit clearance per side. Try 0.3 mm for PETG'),
    ('PrintFlat', '0.8 mm', 'mm', 'Depth of the flat a round log lies on while printing'),
    ('MateWidth', 'LogDia - PrintFlat', 'mm', 'Width of a log, half log or gable where it sits in a notch'),
    ('NotchWidth', 'MateWidth + 2 * Clearance', 'mm', 'Notch width (mating width plus clearance on each side)'),
    ('CourseRise', 'LogDia - 2 * NotchDepth', 'mm', 'Height gained per crossing course'),
    ('HalfLogHeight', 'LogDia - NotchDepth', 'mm', 'Half-log height (flat sits at the notch floor)'),
    ('GableThk', 'MateWidth', 'mm', 'Gable thickness (fills a notch like a log)'),
    ('ShingleThk', '0.125 in', 'mm', 'Shingle thickness'),
    ('FlatShingleWidth', '0.8 in', 'mm', 'Flat shingle width'),
    ('RidgeShingleWidth', '1.125 in', 'mm', 'Ridge shingle width'),
    ('RidgeGrooveWidth', '1.6 mm', 'mm', 'Ridge shingle centre groove width'),
    ('RidgeGrooveDepth', '0.8 mm', 'mm', 'Ridge shingle centre groove depth'),
    ('PanelThk', '0.125 in', 'mm', 'Door and window panel thickness'),
]

# code, component name, length, notch count, style
LOGS = [
    ('L1a', 'log_1insert_1-5_8', '1.625 in', 1, 'round'),
    ('L1b', 'log_1insert_1-1_2_round', '1.5 in', 1, 'round'),
    ('L1oct', 'log_1insert_1-1_2_octagonal', '1.5 in', 1, 'oct'),
    ('L2a', 'log_2insert_4-1_2', '4.5 in', 2, 'round'),
    ('L3', 'log_3insert_7-5_8', '7.625 in', 3, 'round'),
    ('L4', 'log_4insert_10-5_8', '10.625 in', 4, 'round'),
    ('Half2', 'half_log_4-1_2', '4.5 in', 2, 'half'),
    ('Half3', 'half_log_7-1_2', '7.5 in', 3, 'half'),
]
# The rounded-end set: every notched log with rounded ends. code, component name, length, notch count, octagonal
ROUNDED = [
    ('R1a', 'log_1insert_1-5_8_rounded', '1.625 in', 1, False),
    ('R1b', 'log_1insert_1-1_2_round_rounded', '1.5 in', 1, False),
    ('R1oct', 'log_1insert_1-1_2_octagonal_rounded', '1.5 in', 1, True),
    ('R2a', 'log_2insert_4-1_2_rounded', '4.5 in', 2, False),
    ('R2c', 'log_2insert_4-3_4_rounded', '4.75 in', 2, False),
    ('R3', 'log_3insert_7-5_8_rounded', '7.625 in', 3, False),
    ('R4', 'log_4insert_10-5_8_rounded', '10.625 in', 4, False),
]
SOLIDS = [('Solid1', 'solid_log_1-3_8', '1.375 in'), ('Solid2', 'solid_log_1-5_8', '1.625 in')]
FLAT_SHINGLES = [('ShFlat6', 'shingle_flat_6', '6 in'), ('ShFlat9', 'shingle_flat_9', '9 in'), ('ShFlat11', 'shingle_flat_11', '11 in')]
RIDGE_SHINGLES = [('ShRidge5', 'shingle_ridge_5-5_8', '5.625 in'), ('ShRidge6', 'shingle_ridge_6', '6 in'), ('ShRidge9', 'shingle_ridge_9', '9 in')]

# Where each component sits in the layout (cm), so nothing overlaps.
LAYOUT = {
    'log_4insert_10-5_8': (0, 0), 'log_3insert_7-5_8': (0, 3.5), 'half_log_7-1_2': (0, 7),
    'log_2insert_4-1_2': (0, 17.5),
    'half_log_4-1_2': (0, 21), 'log_1insert_1-5_8': (0, 24.5), 'log_1insert_1-1_2_round': (6, 24.5),
    'log_1insert_1-1_2_octagonal': (12, 24.5), 'beveled_end_1-1_2': (18, 24.5),
    'solid_log_1-3_8': (1, 28.5), 'solid_log_1-5_8': (5, 28.5), 'chimney': (10, 29),
    'extra_door': (16, 30), 'extra_window': (24, 30),
    'shingle_flat_11': (32, 0), 'shingle_flat_9': (32, 3.5), 'shingle_flat_6': (32, 7),
    'shingle_ridge_9': (32, 11), 'shingle_ridge_6': (32, 15), 'shingle_ridge_5-5_8': (48, 15),
    'log_4insert_10-5_8_rounded': (0, 0), 'log_3insert_7-5_8_rounded': (0, 3.5), 'log_2insert_4-3_4_rounded': (0, 7),
    'log_2insert_4-1_2_rounded': (0, 10.5), 'log_1insert_1-5_8_rounded': (0, 14), 'log_1insert_1-1_2_round_rounded': (6, 14),
    'log_1insert_1-1_2_octagonal_rounded': (12, 14),
    'gable_plastic_8-1_2': (32, 18.5), 'gable_plastic_small_2notch': (32, 26), 'gable_wood_triangle_4x2': (48, 26),
}


def neg(expr):
    """A coordinate on the negative side of the origin, |value| = expr."""
    return ('-', expr)


class Builder:
    def __init__(self, app):
        self.app = app
        self.design = adsk.fusion.Design.cast(app.activeProduct)
        self.design.designType = adsk.fusion.DesignTypes.ParametricDesignType
        self.um = self.design.unitsManager
        self.design.fusionUnitsManager.distanceDisplayUnits = adsk.fusion.DistanceUnits.MillimeterDistanceUnits
        self.root = self.design.rootComponent
        self.errors = []
        self.groups = []  # (name, first timeline index, last timeline index)

    # ---------- parameters ----------
    def param(self, name, expr, units='mm', comment='', favorite=False):
        ups = self.design.userParameters
        p = ups.itemByName(name)
        if p is None:
            p = ups.add(name, VI(expr), units, comment)
        else:
            p.expression = expr
        if favorite:
            p.isFavorite = True
        return p

    def ev(self, expr, units='cm'):
        return self.um.evaluateExpression(expr, units)

    # ---------- components ----------
    def component(self, name):
        x, y = LAYOUT[name]
        m = adsk.core.Matrix3D.create()
        m.translation = adsk.core.Vector3D.create(x, y, 0)
        occ = self.root.occurrences.addNewComponent(m)
        occ.component.name = name
        return occ.component

    def part(self, name, fn):
        start = self.design.timeline.count
        try:
            comp = self.component(name)
            fn(comp)
            for b in comp.bRepBodies:
                b.name = name
        except Exception:
            self.errors.append((name, traceback.format_exc()))
        end = self.design.timeline.count - 1
        if end > start:
            self.groups.append((name, start, end))

    # ---------- features ----------
    def extrude(self, comp, profiles, dist, op, name, symmetric=False):
        ex = comp.features.extrudeFeatures
        if isinstance(profiles, (list, tuple)):
            coll = adsk.core.ObjectCollection.create()
            for p in profiles:
                coll.add(p)
            profiles = coll
        inp = ex.createInput(profiles, op)
        if symmetric:
            inp.setSymmetricExtent(VI(dist), True)
        else:
            inp.setDistanceExtent(False, VI(dist))
        if op == CUT:
            inp.participantBodies = [comp.bRepBodies.item(0)]
        f = ex.add(inp)
        f.name = name
        return f

    def pattern(self, comp, feature, direction, qty, spacing, name):
        coll = adsk.core.ObjectCollection.create()
        coll.add(feature)
        pats = comp.features.rectangularPatternFeatures
        inp = pats.createInput(coll, direction, VI(qty), VI(spacing), adsk.fusion.PatternDistanceType.SpacingPatternDistanceType)
        f = pats.add(inp)
        f.name = name
        return f

    def notch_params(self, code, length, notches, length_name='Length'):
        self.param(f'{code}_{length_name}', length, 'mm', 'Overall length' if length_name == 'Length' else 'Overall width', True)
        self.param(f'{code}_Notches', str(notches), '', 'Number of notch positions', True)
        self.param(f'{code}_FirstNotch', f'({code}_{length_name} - ({code}_Notches - 1) * NotchCenters) / 2', 'mm',
                   'Centre of the first notch (keeps the row of notches centred)')
        # Fusion cannot pattern a single instance, so the pattern always makes at least two copies.
        # With one notch the step shrinks to 0.001 mm and the second copy lands on the first.
        n1 = f'min(1; {code}_Notches - 1)'
        self.param(f'{code}_NotchStep', f'NotchCenters * {n1} + 0.001 mm * (1 - {n1})', 'mm',
                   'Pattern step: NotchCenters, or about zero when there is only one notch')

    def side_notches(self, comp, code):
        """Notches on both sides of a log that lies along X on the bed (log axis at Y = 0)."""
        s = Sk(self, comp, 'xy', 'Notch')
        x0, x1 = f'{code}_FirstNotch - NotchWidth / 2', f'{code}_FirstNotch + NotchWidth / 2'
        yi, yo = 'LogDia / 2 - NotchDepth', 'LogDia / 2 + 1 mm'
        s.rect((x0, yi), (x1, yo))
        s.rect((x0, neg(yi)), (x1, neg(yo)))
        cut = self.extrude(comp, s.profiles(), 'LogDia', CUT, 'Notch cut')
        self.pattern(comp, cut, comp.xConstructionAxis, f'max({code}_Notches; 2)', f'{code}_NotchStep', 'Notch pattern')

    def bed_flat(self, comp, length):
        """Cut away everything below the bed (Z = 0): the printing flat of an octagonal log drawn PrintFlat too low."""
        s = Sk(self, comp, 'yz', 'Printing flat')
        s.rect((neg('LogDia / 2 + 1 mm'), neg('PrintFlat + 1 mm')), ('LogDia / 2 + 1 mm', 0))
        self.extrude(comp, s.profiles(), length, CUT, 'Printing flat')

    def bottom_notches(self, comp, code):
        """Notches in the bottom edge (Y = 0) of a gable profile drawn in XY."""
        s = Sk(self, comp, 'xy', 'Notch')
        s.rect((f'{code}_FirstNotch - NotchWidth / 2', neg('1 mm')), (f'{code}_FirstNotch + NotchWidth / 2', 'NotchDepth'))
        cut = self.extrude(comp, s.profiles(), 'GableThk', CUT, 'Notch cut')
        self.pattern(comp, cut, comp.xConstructionAxis, f'max({code}_Notches; 2)', f'{code}_NotchStep', 'Notch pattern')

    # ---------- parts ----------
    def log(self, code, name, length, notches, style):
        self.notch_params(code, length, notches)
        L = f'{code}_Length'

        def build(comp):
            if style == 'oct':
                s = Sk(self, comp, 'yz', 'Section')
                s.rect((neg('LogDia / 2'), neg('PrintFlat')), ('LogDia / 2', 'LogDia - PrintFlat'))
                ext = self.extrude(comp, s.profiles(), L, NEW, 'Log')
                edges = adsk.core.ObjectCollection.create()
                for e in ext.bodies.item(0).edges:
                    a, b = e.startVertex.geometry, e.endVertex.geometry
                    if abs(a.y - b.y) < 1e-6 and abs(a.z - b.z) < 1e-6:
                        edges.add(e)
                ch = comp.features.chamferFeatures
                ci = ch.createInput2()
                ci.chamferEdgeSets.addEqualDistanceChamferEdgeSet(edges, VI('LogDia * (1 - sqrt(2) / 2)'), False)
                ch.add(ci).name = 'Octagon corners'
                self.bed_flat(comp, L)
                self.side_notches(comp, code)
                return
            if style == 'half':
                s = Sk(self, comp, 'yz', 'Section')
                s.circle_on_bed('HalfLogHeight - LogDia / 2')
                self.extrude(comp, [s.biggest()], L, NEW, 'Log')
                # side flat, like the round logs' printing flat, so the half log is MateWidth wide in a notch
                f = Sk(self, comp, 'yz', 'Side flat')
                f.rect((neg('LogDia / 2 + 1 mm'), neg('1 mm')), (neg('LogDia / 2 - PrintFlat'), 'HalfLogHeight + 1 mm'))
                self.extrude(comp, f.profiles(), L, CUT, 'Side flat')
                n = Sk(self, comp, 'xz', 'Notch')
                n.rect((f'{code}_FirstNotch - NotchWidth / 2', 'HalfLogHeight - NotchDepth'),
                       (f'{code}_FirstNotch + NotchWidth / 2', 'HalfLogHeight + 1 mm'))
                cut = self.extrude(comp, n.profiles(), 'LogDia + 2 mm', CUT, 'Notch cut', symmetric=True)
                self.pattern(comp, cut, comp.xConstructionAxis, f'max({code}_Notches; 2)', f'{code}_NotchStep', 'Notch pattern')
                return
            s = Sk(self, comp, 'yz', 'Section')
            s.circle_on_bed('LogDia / 2 - PrintFlat')
            if style == 'rounded_ends':
                # Round the ends on the full cylinder first, then cut the printing flat.
                self.param(f'{code}_EndRadius', '4 mm', 'mm', 'Radius of the rounded ends', True)
                ext = self.extrude(comp, s.profiles(), L, NEW, 'Log')
                edges = adsk.core.ObjectCollection.create()
                for e in ext.bodies.item(0).edges:
                    if e.geometry.curveType != adsk.core.Curve3DTypes.Line3DCurveType:
                        edges.add(e)
                fl = comp.features.filletFeatures
                fi = fl.createInput()
                fi.edgeSetInputs.addConstantRadiusEdgeSet(edges, VI(f'{code}_EndRadius'), True)
                fl.add(fi).name = 'Rounded ends'
                self.extrude(comp, [s.smallest()], L, CUT, 'Printing flat')
            else:
                self.extrude(comp, [s.biggest()], L, NEW, 'Log')
            self.side_notches(comp, code)

        self.part(name, build)

    def bevel_short(self):
        code = 'BevShort'
        self.param(f'{code}_Length', '1.5 in', 'mm', 'Length along the long edge', True)
        self.param(f'{code}_Angle', '39 deg', 'deg', 'Angle of the slanted end (roof pitch of the wooden triangle)', True)

        def build(comp):
            s = Sk(self, comp, 'yz', 'Section')
            s.circle_on_bed('LogDia / 2 - PrintFlat')
            self.extrude(comp, [s.biggest()], f'{code}_Length', NEW, 'Log')
            c = Sk(self, comp, 'xy', 'Slant')
            c.poly([(f'{code}_Length', neg('LogDia / 2')), (f'{code}_Length', 'LogDia / 2'),
                    (f'{code}_Length - LogDia / tan({code}_Angle)', 'LogDia / 2')])
            self.extrude(comp, c.profiles(), 'LogDia', CUT, 'Slanted end')

        self.part('beveled_end_1-1_2', build)

    def solid(self, code, name, length):
        self.param(f'{code}_Length', length, 'mm', 'Length', True)

        def build(comp):
            s = Sk(self, comp, 'xy', 'Section')
            s.circle_at_origin('LogDia')
            self.extrude(comp, s.profiles(), f'{code}_Length', NEW, 'Log')

        self.part(name, build)

    def shingle(self, code, name, length, ridge):
        self.param(f'{code}_Length', length, 'mm', 'Length', True)
        W = 'RidgeShingleWidth' if ridge else 'FlatShingleWidth'

        def build(comp):
            s = Sk(self, comp, 'xy', 'Outline')
            s.rect((0, neg(f'{W} / 2')), (f'{code}_Length', f'{W} / 2'))
            self.extrude(comp, s.profiles(), 'ShingleThk', NEW, 'Board')
            if ridge:
                g = Sk(self, comp, 'yz', 'Groove')
                g.poly([(neg('RidgeGrooveWidth / 2'), 'ShingleThk'), ('RidgeGrooveWidth / 2', 'ShingleThk'),
                        (0, 'ShingleThk - RidgeGrooveDepth')])
                self.extrude(comp, g.profiles(), f'{code}_Length', CUT, 'Groove')

        self.part(name, build)

    def plastic_gable_params(self, code, width, steps, notches, height):
        self.notch_params(code, width, notches, 'Width')
        self.param(f'{code}_Steps', str(steps), '', 'Roof steps per side', True)
        self.param(f'{code}_EaveHeight', '7.5 mm', 'mm', 'Height of the slope start above the base')
        self.param(f'{code}_LipThk', '5.4 mm', 'mm', 'Eave lip thickness')
        self.param(f'{code}_LipHeight', '3.6 mm', 'mm', 'Eave lip height above the slope start')
        self.param(f'{code}_Riser', '2.9 mm', 'mm', 'Vertical riser of each roof step')
        self.param(f'{code}_Height', height.replace('@', code), 'mm', 'Overall height at the peak', True)
        self.param(f'{code}_StepRun', f'({code}_Width / 2 - {code}_LipThk) / {code}_Steps', 'mm', 'Horizontal run of one step')
        self.param(f'{code}_TreadRise', f'({code}_Height - {code}_EaveHeight - ({code}_Steps - 1) * {code}_Riser) / {code}_Steps', 'mm', 'Rise of one sloped tread')
        self.param(f'{code}_StepPitch', f'sqrt({code}_StepRun ^ 2 + ({code}_TreadRise + {code}_Riser) ^ 2)', 'mm', 'Step spacing measured along the slope')

    def plastic_gable(self, code, name):
        def build(comp):
            e0, lip = f'{code}_EaveHeight', f'{code}_LipThk'
            s = Sk(self, comp, 'xy', 'Half profile')
            s.poly([(0, 0), (f'{code}_Width / 2', 0), (f'{code}_Width / 2', f'{code}_Height + {code}_Riser'),
                                 (lip, e0), (lip, f'{e0} + {code}_LipHeight'), (0, f'{e0} + {code}_LipHeight')])
            self.extrude(comp, s.profiles(), 'GableThk', NEW, 'Half gable')
            t = Sk(self, comp, 'xy', 'Step')
            # The first edge of the step triangle runs up the slope; the pattern follows it.
            _, tl = t.poly([(lip, e0), (f'{lip} + {code}_StepRun', f'{e0} + {code}_TreadRise + {code}_Riser'),
                            (f'{lip} + {code}_StepRun', f'{e0} + {code}_TreadRise')])
            cut = self.extrude(comp, t.profiles(), 'GableThk', CUT, 'Step cut')
            pat = self.pattern(comp, cut, tl[0], f'{code}_Steps', f'{code}_StepPitch', 'Step pattern')
            bb = comp.bRepBodies.item(0).boundingBox
            if bb.maxPoint.y > self.ev(f'{code}_Height') + 1e-6:  # peak not trimmed: pattern ran downhill
                pat.distanceOne.expression = f'-{code}_StepPitch'
            planes = comp.constructionPlanes
            pi = planes.createInput()
            pi.setByOffset(comp.yZConstructionPlane, VI(f'{code}_Width / 2'))
            mid = planes.add(pi)
            mid.name = 'Centre plane'
            bodies = adsk.core.ObjectCollection.create()
            bodies.add(comp.bRepBodies.item(0))
            mi = comp.features.mirrorFeatures.createInput(bodies, mid)
            mi.isCombine = True
            comp.features.mirrorFeatures.add(mi).name = 'Mirror half'
            self.bottom_notches(comp, code)

        self.part(name, build)

    def wood_gable(self):
        code = 'GableTri'
        self.notch_params(code, '4.875 in', 2, 'Width')
        self.param(f'{code}_Height', '2 in', 'mm', 'Height at the peak', True)

        def build(comp):
            s = Sk(self, comp, 'xy', 'Profile')
            s.poly([(0, 0), (f'{code}_Width', 0), (f'{code}_Width / 2', f'{code}_Height')])
            self.extrude(comp, s.profiles(), 'GableThk', NEW, 'Gable')
            self.bottom_notches(comp, code)

        self.part('gable_wood_triangle_4x2', build)

    def chimney(self):
        c = 'Chimney'
        self.param(f'{c}_Width', '1.375 in', 'mm', 'Width across the ridge', True)
        self.param(f'{c}_Depth', '1 in', 'mm', 'Depth along the ridge', True)
        self.param(f'{c}_Height', '1.2 in', 'mm', 'Overall height', True)
        self.param(f'{c}_Wall', '0.12 in', 'mm', 'Wall thickness of the open top')
        self.param(f'{c}_Pocket', '0.5 in', 'mm', 'Depth of the open top')
        self.param(f'{c}_VDepth', f'{c}_Width / 2 * tan(PlasticRoofAngle)', 'mm', 'Depth of the V cut that straddles the ridge')

        def build(comp):  # printed upside down: open top on the bed, V facing up
            s = Sk(self, comp, 'xy', 'Outline')
            s.rect((neg(f'{c}_Width / 2'), neg(f'{c}_Depth / 2')), (f'{c}_Width / 2', f'{c}_Depth / 2'))
            self.extrude(comp, s.profiles(), f'{c}_Height', NEW, 'Block')
            p = Sk(self, comp, 'xy', 'Pocket')
            p.rect((neg(f'{c}_Width / 2 - {c}_Wall'), neg(f'{c}_Depth / 2 - {c}_Wall')),
                   (f'{c}_Width / 2 - {c}_Wall', f'{c}_Depth / 2 - {c}_Wall'))
            self.extrude(comp, p.profiles(), f'{c}_Pocket', CUT, 'Open top')
            v = Sk(self, comp, 'xz', 'Ridge V')
            v.poly([(neg(f'{c}_Width / 2'), f'{c}_Height'), (f'{c}_Width / 2', f'{c}_Height'), (0, f'{c}_Height - {c}_VDepth')])
            self.extrude(comp, v.profiles(), f'{c}_Depth + 2 mm', CUT, 'Ridge V cut', symmetric=True)

        self.part('chimney', build)

    def panel(self, code, name, courses, opening):
        self.param(f'{code}_Courses', str(courses), '', 'Log courses the panel spans', True)
        self.param(f'{code}_Width', 'NotchCenters - LogDia - 2 * Clearance', 'mm', 'Width (fits the gap between crossing logs)')
        self.param(f'{code}_Height', f'({code}_Courses - 1) * CourseRise + LogDia - 2 * Clearance', 'mm', 'Height')
        if opening:
            self.param(f'{code}_OpeningWidth', '1.125 in', 'mm', 'Opening width', True)
            self.param(f'{code}_OpeningHeight', '0.625 in', 'mm', 'Opening height', True)

        def build(comp):
            s = Sk(self, comp, 'xy', 'Outline')
            s.rect((neg(f'{code}_Width / 2'), neg(f'{code}_Height / 2')), (f'{code}_Width / 2', f'{code}_Height / 2'))
            if opening:
                s.rect((neg(f'{code}_OpeningWidth / 2'), neg(f'{code}_OpeningHeight / 2')),
                       (f'{code}_OpeningWidth / 2', f'{code}_OpeningHeight / 2'))
            self.extrude(comp, [s.biggest()], 'PanelThk', NEW, 'Panel')

        self.part(name, build)

    def rounded_log(self, code, name, length, notches, octagonal):
        """A notched log with both ends rounded over by the shared EndRadius fillet."""
        self.notch_params(code, length, notches)
        L = f'{code}_Length'

        def end_edges(body, x_len):
            # every edge lying in one of the two end faces (x = 0 or x = length)
            edges = adsk.core.ObjectCollection.create()
            for e in body.edges:
                a, b = e.startVertex, e.endVertex
                xs = [v.geometry.x for v in (a, b) if v] or [e.pointOnEdge.x]
                if all(abs(x) < 1e-6 for x in xs) or all(abs(x - x_len) < 1e-6 for x in xs):
                    edges.add(e)
            return edges

        def build(comp):
            s = Sk(self, comp, 'yz', 'Section')
            if octagonal:
                s.rect((neg('LogDia / 2'), neg('PrintFlat')), ('LogDia / 2', 'LogDia - PrintFlat'))
                ext = self.extrude(comp, s.profiles(), L, NEW, 'Log')
                body = ext.bodies.item(0)
                edges = adsk.core.ObjectCollection.create()
                for e in body.edges:
                    a, b = e.startVertex.geometry, e.endVertex.geometry
                    if abs(a.y - b.y) < 1e-6 and abs(a.z - b.z) < 1e-6:
                        edges.add(e)
                ch = comp.features.chamferFeatures
                ci = ch.createInput2()
                ci.chamferEdgeSets.addEqualDistanceChamferEdgeSet(edges, VI('LogDia * (1 - sqrt(2) / 2)'), False)
                ch.add(ci).name = 'Octagon corners'
            else:
                # round the ends on the full cylinder first, then cut the printing flat
                s.circle_on_bed('LogDia / 2 - PrintFlat')
                ext = self.extrude(comp, s.profiles(), L, NEW, 'Log')
                body = ext.bodies.item(0)
            fl = comp.features.filletFeatures
            fi = fl.createInput()
            fi.edgeSetInputs.addConstantRadiusEdgeSet(end_edges(body, self.ev(L)), VI('EndRadius'), True)
            fl.add(fi).name = 'Rounded ends'
            if octagonal:
                self.bed_flat(comp, L)
            else:
                self.extrude(comp, [s.smallest()], L, CUT, 'Printing flat')
            self.side_notches(comp, code)

        self.part(name, build)

    def build_rounded(self):
        for name, expr, units, comment in SHARED[:8]:  # the log sizes only
            self.param(name, expr, units, comment, True)
        self.param('EndRadius', '4 mm', 'mm', 'Radius of the rounded log ends', True)
        for args in ROUNDED:
            self.rounded_log(*args)
        self.group_and_fit()
        return self.errors

    def group_and_fit(self):
        # One timeline group per part, added last-to-first so earlier indices stay valid.
        try:
            tg = self.design.timeline.timelineGroups
            for name, a, b in reversed(self.groups):
                tg.add(a, b).name = name
        except Exception:
            self.errors.append(('timeline groups', traceback.format_exc()))
        self.app.activeViewport.fit()

    # ---------- everything ----------
    def build_all(self):
        for name, expr, units, comment in SHARED:
            self.param(name, expr, units, comment, True)
        for code, name, length, notches, style in LOGS:
            self.log(code, name, length, notches, style)
        self.bevel_short()
        for code, name, length in SOLIDS:
            self.solid(code, name, length)

        self.plastic_gable_params('GableL', '8.5 in', 7, 3, '2.25 in')
        self.param('PlasticRoofAngle', 'atan((GableL_Height + GableL_Riser - GableL_EaveHeight) / (GableL_Width / 2 - GableL_LipThk))',
                   'deg', 'Pitch of the large plastic gable. The small gable and the chimney follow it', True)
        # Small gable: same pitch as the large one, so its height follows from its width.
        self.plastic_gable_params('GableS', '5.8 in', 5, 2, '@_EaveHeight + tan(PlasticRoofAngle) * (@_Width / 2 - @_LipThk) - @_Riser')
        self.plastic_gable('GableL', 'gable_plastic_8-1_2')
        self.plastic_gable('GableS', 'gable_plastic_small_2notch')
        self.wood_gable()

        for code, name, length in FLAT_SHINGLES:
            self.shingle(code, name, length, False)
        for code, name, length in RIDGE_SHINGLES:
            self.shingle(code, name, length, True)
        self.chimney()
        self.panel('Door', 'extra_door', 4, False)
        self.panel('Window', 'extra_window', 3, True)
        self.group_and_fit()
        return self.errors


class Sk:
    """A sketch on an origin plane whose points are given as parameter expressions in model axes.

    A point is (a, b) for the plane's two axes ('xy' -> X and Y, 'xz' -> X and Z, 'yz' -> Y and Z).
    Each coordinate is 0, an expression string (positive side) or neg(expression).
    Every non-zero coordinate becomes a driving dimension from the sketch origin."""

    def __init__(self, b, comp, plane, name):
        self.b = b
        self.axes = {'xy': 'xy', 'xz': 'xz', 'yz': 'yz'}[plane]
        pl = {'xy': comp.xYConstructionPlane, 'xz': comp.xZConstructionPlane, 'yz': comp.yZConstructionPlane}[plane]
        self.sk = comp.sketches.add(pl)
        self.sk.name = name
        o = self.sk.modelToSketchSpace(P3(0, 0, 0))
        self.horiz = {}
        for a in self.axes:
            v = [0, 0, 0]
            v['xyz'.index(a)] = 1
            p = self.sk.modelToSketchSpace(P3(*v))
            self.horiz[a] = abs(p.x - o.x) > 0.5

    def _val(self, c):
        if c in (0, None):
            return 0.0
        return -self.b.ev(c[1]) if isinstance(c, tuple) else self.b.ev(c)

    @staticmethod
    def _expr(c):
        if c in (0, None):
            return None
        return c[1] if isinstance(c, tuple) else c

    def _p3(self, pt):
        m = [0.0, 0.0, 0.0]
        for a, c in zip(self.axes, pt):
            m['xyz'.index(a)] = self._val(c)
        return self.sk.modelToSketchSpace(P3(*m))

    def pin(self, sp, pt, seen=None):
        o, gc, dims = self.sk.originPoint, self.sk.geometricConstraints, self.sk.sketchDimensions
        H = adsk.fusion.DimensionOrientations.HorizontalDimensionOrientation
        V = adsk.fusion.DimensionOrientations.VerticalDimensionOrientation
        if all(self._expr(c) is None for c in pt):
            gc.addCoincident(sp, o)
            return
        for a, c in zip(self.axes, pt):
            e = self._expr(c)
            g = sp.geometry
            if e is None:
                (gc.addVerticalPoints if self.horiz[a] else gc.addHorizontalPoints)(o, sp)
                continue
            # A coordinate already dimensioned on another point of this shape is not dimensioned twice
            # (Fusion rejects that as over-constrained); the point is lined up with the first one instead.
            key = (a, c)
            if seen is not None and key in seen:
                (gc.addVerticalPoints if self.horiz[a] else gc.addHorizontalPoints)(seen[key], sp)
                continue
            if seen is not None:
                seen[key] = sp
            if self.horiz[a]:
                dims.addDistanceDimension(o, sp, H, P3(g.x / 2, g.y + 0.3, 0)).parameter.expression = e
            else:
                dims.addDistanceDimension(o, sp, V, P3(g.x + 0.3, g.y / 2, 0)).parameter.expression = e

    def _chain(self, pts):
        L = self.sk.sketchCurves.sketchLines
        P = [self._p3(p) for p in pts]
        first = L.addByTwoPoints(P[0], P[1])
        lines, sps = [first], [first.startSketchPoint, first.endSketchPoint]
        for k in range(2, len(P)):
            ln = L.addByTwoPoints(sps[-1], P[k])
            lines.append(ln)
            sps.append(ln.endSketchPoint)
        lines.append(L.addByTwoPoints(sps[-1], sps[0]))
        return sps, lines

    def poly(self, pts):
        sps, lines = self._chain(pts)
        seen = {}
        for sp, pt in zip(sps, pts):
            self.pin(sp, pt, seen)
        return sps, lines

    def rect(self, a, b):
        sps, lines = self._chain([a, (b[0], a[1]), b, (a[0], b[1])])
        gc = self.sk.geometricConstraints
        for ln in lines:
            s, e = ln.startSketchPoint.geometry, ln.endSketchPoint.geometry
            (gc.addHorizontal if abs(s.y - e.y) < abs(s.x - e.x) else gc.addVertical)(ln)
        self.pin(sps[0], a)
        self.pin(sps[2], b)
        return sps, lines

    def circle_at_origin(self, dia):
        c = self.sk.sketchCurves.sketchCircles.addByCenterRadius(self.sk.originPoint, self.b.ev(dia) / 2)
        r = self.b.ev(dia) / 2
        self.sk.sketchDimensions.addDiameterDimension(c, P3(r, r, 0)).parameter.expression = dia
        return c

    def circle_on_bed(self, centre_height):
        """LogDia circle in the YZ plane, centred centre_height above the bed, plus the chord along the bed (Z = 0)."""
        zc, r = self.b.ev(centre_height), self.b.ev('LogDia') / 2
        centre = (0, centre_height)
        c = self.sk.sketchCurves.sketchCircles.addByCenterRadius(self._p3(centre), r)
        self.pin(c.centerSketchPoint, centre)
        cg = c.centerSketchPoint.geometry
        self.sk.sketchDimensions.addDiameterDimension(c, P3(cg.x + r, cg.y + r, 0)).parameter.expression = 'LogDia'
        half = (r * r - zc * zc) ** 0.5
        a = self.sk.modelToSketchSpace(P3(0, -half, 0))
        b = self.sk.modelToSketchSpace(P3(0, half, 0))
        ln = self.sk.sketchCurves.sketchLines.addByTwoPoints(a, b)
        gc, o = self.sk.geometricConstraints, self.sk.originPoint
        gc.addCoincident(ln.startSketchPoint, c)
        gc.addCoincident(ln.endSketchPoint, c)
        gc.addCoincident(o, ln)  # the chord passes through the origin ...
        (gc.addVertical if self.horiz['z'] else gc.addHorizontal)(ln)  # ... and lies along Y
        return c

    def profiles(self):
        return [self.sk.profiles.item(i) for i in range(self.sk.profiles.count)]

    def _sorted(self):
        return sorted(self.profiles(), key=lambda p: p.areaProperties().area)

    def biggest(self):
        return self._sorted()[-1]

    def smallest(self):
        return self._sorted()[0]


def build(app):
    b = Builder(app)
    return b.build_rounded() if PART_SET == 'rounded' else b.build_all()


def run(context):
    app = adsk.core.Application.get()
    try:
        app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        errors = build(app)
        if errors:
            app.userInterface.messageBox('Finished with errors:\n\n' + '\n\n'.join(f'{n}:\n{t}' for n, t in errors))
    except Exception:
        app.userInterface.messageBox(traceback.format_exc())
