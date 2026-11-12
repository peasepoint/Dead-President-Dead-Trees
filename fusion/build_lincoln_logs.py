# Builds the parts from parts.mjs as editable, parametric Autodesk Fusion designs: one design per folder in stl/.
#
# Run it from Fusion: Utilities > Add-Ins > Scripts and Add-Ins > "+" > pick this folder > Run.
# It opens a new design and builds the set named by PART_SET below:
#   'roof_parts'          gables, shingles, chimney, door and window (stl/roof_parts/)
#   'smooth'              the 11 logs, round, plain (stl/smooth/)
#   'flat_end_round'      the 11 logs, round, flat ends, plus their wood-grain meshes (stl/flat_end_round/)
#   'flat_end_octagonal'  the 11 logs, octagonal, flat ends, plus their wood-grain meshes (stl/flat_end_octagonal/)
#   'ball_end_round'      the 11 logs, round, rounded ends, plus their wood-grain meshes (stl/ball_end_round/)
#
# How a design is organised (see fusion/README.md for the full parameter list):
#   - Shared sizes (LogDia, NotchDepth, NotchCenters, Clearance ...) are user parameters.
#   - Each part has its own parameters, prefixed with a short code (L3_Length, L3_Notches ...).
#   - Every sketch dimension and feature distance is an expression of those parameters.
#   - Each body is modelled in its printing orientation, sitting on Z = 0, at the same coordinates as its STL:
#     notched logs, beveled end and solid logs standing on end, half logs flat side down, gables and shingles flat.
#   - The wood grain, the hollowed ends and the break-away supports in the notches are not parametric. In the
#     wood-grain sets each component also holds its STL as a mesh body, which carries them.
import os
import adsk.core
import adsk.fusion
import traceback

PART_SET = 'flat_end_round'
SETS = ('roof_parts', 'smooth', 'flat_end_round', 'flat_end_octagonal', 'ball_end_round')

P3 = adsk.core.Point3D.create
VI = adsk.core.ValueInput.createByString
NEW = adsk.fusion.FeatureOperations.NewBodyFeatureOperation
CUT = adsk.fusion.FeatureOperations.CutFeatureOperation

# (name, expression, units, comment). Order matters: a parameter can only use ones above it.
LOG_PARAMS = [
    ('LogDia', '0.75 in', 'mm', 'Log diameter (across the flats of an octagonal log)'),
    ('NotchDepth', '0.1875 in', 'mm', 'Notch depth, each side of a log'),
    ('NotchCenters', '3 in', 'mm', 'Spacing between notch centres'),
    ('Clearance', '0.2 mm', 'mm', 'Fit clearance per side. Try 0.3 mm for PETG'),
    ('MateWidth', 'LogDia', 'mm', 'Width of a log, half log or gable where it sits in a notch'),
    ('NotchWidth', 'MateWidth + 2 * Clearance', 'mm', 'Notch width (mating width plus clearance on each side)'),
    ('CourseRise', 'LogDia - 2 * NotchDepth', 'mm', 'Height gained per crossing course'),
    ('HalfLogHeight', 'LogDia - NotchDepth', 'mm', 'Half-log height (flat sits at the notch floor)'),
]
ROOF_PARAMS = [
    ('GableThk', 'MateWidth', 'mm', 'Gable thickness (fills a notch like a log)'),
    ('ShingleThk', '0.125 in', 'mm', 'Shingle thickness'),
    ('FlatShingleWidth', '0.8 in', 'mm', 'Flat shingle width'),
    ('RidgeShingleWidth', '1.125 in', 'mm', 'Ridge shingle width'),
    ('RidgeGrooveWidth', '1.6 mm', 'mm', 'Ridge shingle centre groove width'),
    ('RidgeGrooveDepth', '0.8 mm', 'mm', 'Ridge shingle centre groove depth'),
    ('PanelThk', '0.125 in', 'mm', 'Door and window panel thickness'),
]

# The 11 logs, the same in every log set. code, base name, length, notches, kind, section
# kind: 'log' (notched, standing), 'half' (lying, notches on top), 'bevel' (standing, top cut on a slant), 'solid'
# section: 'set' takes the set's section (round or octagonal); 'hex' is the hex log in every set
LOGS = [
    ('L1a', 'log_1insert_1-5_8', '1.625 in', 1, 'log', 'set'),
    ('L1b', 'log_1insert_1-1_2_round', '1.5 in', 1, 'log', 'set'),
    ('L1hex', 'log_1insert_1-1_2_hex', '1.5 in', 1, 'log', 'hex'),
    ('L2', 'log_2insert_4-1_2', '4.5 in', 2, 'log', 'set'),
    ('L3', 'log_3insert_7-5_8', '7.625 in', 3, 'log', 'set'),
    ('L4', 'log_4insert_10-5_8', '10.625 in', 4, 'log', 'set'),
    ('Half2', 'half_log_4-1_2', '4.5 in', 2, 'half', 'set'),
    ('Half3', 'half_log_7-1_2', '7.5 in', 3, 'half', 'set'),
    ('Bev', 'beveled_end_1-1_2', '1.5 in', 0, 'bevel', 'set'),
    ('Solid1', 'solid_log_1-3_8', '1.375 in', 0, 'solid', 'set'),
    ('Solid2', 'solid_log_1-5_8', '1.625 in', 0, 'solid', 'set'),
]
# per log set: section, rounded ends, wood-grain meshes, name suffix
LOG_SETS = {
    'smooth': ('round', False, False, ''),
    'flat_end_round': ('round', False, True, ''),
    'flat_end_octagonal': ('oct', False, True, '_oct'),
    'ball_end_round': ('round', True, True, '_rounded'),
}


def log_name(base, part_set):
    if part_set == 'flat_end_octagonal' and base == 'log_1insert_1-1_2_round':
        return 'log_1insert_1-1_2_oct'  # octagonal, so not "round"
    return base + LOG_SETS[part_set][3]


FLAT_SHINGLES = [('ShFlat6', 'shingle_flat_6', '6 in'), ('ShFlat9', 'shingle_flat_9', '9 in'), ('ShFlat11', 'shingle_flat_11', '11 in')]
RIDGE_SHINGLES = [('ShRidge5', 'shingle_ridge_5-5_8', '5.625 in'), ('ShRidge6', 'shingle_ridge_6', '6 in'), ('ShRidge9', 'shingle_ridge_9', '9 in')]

# Where each component sits in the layout (cm), so nothing overlaps. Logs are placed by base name.
LAYOUT = {
    'log_1insert_1-5_8': (0, 0), 'log_1insert_1-1_2_round': (3, 0), 'log_1insert_1-1_2_hex': (6, 0),
    'log_2insert_4-1_2': (9, 0), 'log_3insert_7-5_8': (12, 0), 'log_4insert_10-5_8': (15, 0),
    'beveled_end_1-1_2': (18, 0), 'solid_log_1-3_8': (21, 0), 'solid_log_1-5_8': (24, 0),
    'half_log_4-1_2': (0, 4), 'half_log_7-1_2': (0, 7),
    'shingle_flat_11': (32, 0), 'shingle_flat_9': (32, 3.5), 'shingle_flat_6': (32, 7),
    'shingle_ridge_9': (32, 11), 'shingle_ridge_6': (32, 15), 'shingle_ridge_5-5_8': (48, 15),
    'gable_plastic_8-1_2': (32, 18.5), 'gable_plastic_small_2notch': (32, 26), 'gable_wood_triangle_4x2': (48, 26),
    'chimney': (10, 29), 'extra_door': (16, 30), 'extra_window': (24, 30),
}


def neg(expr):
    """A coordinate on the negative side of the origin, |value| = expr."""
    return ('-', expr)


def edges_where(body, pred):
    """Edges of body whose bounding box satisfies pred(min point, max point)."""
    coll = adsk.core.ObjectCollection.create()
    for e in body.edges:
        bb = e.boundingBox
        if pred(bb.minPoint, bb.maxPoint):
            coll.add(e)
    return coll


class Builder:
    def __init__(self, app, part_set, stl_dir=None):
        self.app = app
        self.part_set = part_set
        self.stl_dir = stl_dir
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
    def component(self, name, place=None):
        x, y = LAYOUT[place or name]
        m = adsk.core.Matrix3D.create()
        m.translation = adsk.core.Vector3D.create(x, y, 0)
        occ = self.root.occurrences.addNewComponent(m)
        occ.component.name = name
        return occ.component

    def part(self, name, fn, place=None):
        start = self.design.timeline.count
        try:
            comp = self.component(name, place)
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

    def bottom_notches(self, comp, code):
        """Notches in the bottom edge (Y = 0) of a gable profile drawn in XY."""
        s = Sk(self, comp, 'xy', 'Notch')
        s.rect((f'{code}_FirstNotch - NotchWidth / 2', neg('1 mm')), (f'{code}_FirstNotch + NotchWidth / 2', 'NotchDepth'))
        cut = self.extrude(comp, s.profiles(), 'GableThk', CUT, 'Notch cut')
        self.pattern(comp, cut, comp.xConstructionAxis, f'max({code}_Notches; 2)', f'{code}_NotchStep', 'Notch pattern')

    # ---------- logs ----------
    def notch_cuts(self, comp, code):
        """Square notches in a log standing on end along Z: material beyond the notch floors (|Y| > LogDia / 2 -
        NotchDepth) is cut away over NotchWidth round each notch centre, and the cut is patterned up the log."""
        s = Sk(self, comp, 'yz', 'Notch')
        z0, z1 = f'{code}_FirstNotch - NotchWidth / 2', f'{code}_FirstNotch + NotchWidth / 2'
        yi, yo = 'LogDia / 2 - NotchDepth', 'LogDia / 2 + 2 mm'
        s.rect((yi, z0), (yo, z1))
        s.rect((neg(yi), z0), (neg(yo), z1))
        cut = self.extrude(comp, s.profiles(), 'LogDia + 4 mm', CUT, 'Notch cut', symmetric=True)
        self.pattern(comp, cut, comp.zConstructionAxis, f'max({code}_Notches; 2)', f'{code}_NotchStep', 'Notch pattern')

    def section_body(self, comp, section, length, centre=(0, 0)):
        """A prism standing on Z = 0, length tall, with its section centred at centre (an XY point)."""
        cx, cy = centre
        s = Sk(self, comp, 'xy', 'Section')
        if section == 'oct':
            if cx or cy:  # centred on (R, R): the square runs from the origin
                s.rect((0, 0), ('LogDia', 'LogDia'))
            else:
                s.rect((neg('LogDia / 2'), neg('LogDia / 2')), ('LogDia / 2', 'LogDia / 2'))
            body = self.extrude(comp, s.profiles(), length, NEW, 'Log').bodies.item(0)
            self.octagon_corners(comp, edges_where(body, lambda a, b: abs(a.x - b.x) < 1e-6 and abs(a.y - b.y) < 1e-6))
            return body
        if cx or cy:
            s.circle_at(centre, 'LogDia')
        else:
            s.circle_at_origin('LogDia')
        body = self.extrude(comp, s.profiles(), length, NEW, 'Log').bodies.item(0)
        if section == 'hex':
            # six shallow flats: top and bottom (+/-Y), cut HexDip deep, then patterned round the axis at 60 deg
            f = Sk(self, comp, 'xy', 'Hex flats')
            f.rect((neg('LogDia / 2 + 1 mm'), 'LogDia / 2 - HexDip'), ('LogDia / 2 + 1 mm', 'LogDia / 2 + 1 mm'))
            f.rect((neg('LogDia / 2 + 1 mm'), neg('LogDia / 2 - HexDip')), ('LogDia / 2 + 1 mm', neg('LogDia / 2 + 1 mm')))
            cut = self.extrude(comp, f.profiles(), length, CUT, 'Hex flats')
            coll = adsk.core.ObjectCollection.create()
            coll.add(cut)
            ci = comp.features.circularPatternFeatures.createInput(coll, comp.zConstructionAxis)
            ci.quantity = VI('3')
            ci.totalAngle = VI('120 deg')
            ci.isSymmetric = False
            comp.features.circularPatternFeatures.add(ci).name = 'Hex flats pattern'
        return body

    def octagon_corners(self, comp, edges):
        ch = comp.features.chamferFeatures
        ci = ch.createInput2()
        ci.chamferEdgeSets.addEqualDistanceChamferEdgeSet(edges, VI('LogDia * (1 - sqrt(2) / 2)'), False)
        ch.add(ci).name = 'Octagon corners'

    def round_ends(self, comp, body, pred):
        """Fillet the end-face edges picked by pred(min point, max point) with EndRadius."""
        edges = edges_where(body, pred)
        fl = comp.features.filletFeatures
        fi = fl.createInput()
        fi.edgeSetInputs.addConstantRadiusEdgeSet(edges, VI('EndRadius'), False)
        fl.add(fi).name = 'Rounded ends'

    def add_mesh(self, comp, name):
        """The part's STL as a mesh body (wood grain, hollow ends, supports), at the same coordinates."""
        path = os.path.join(self.stl_dir, name + '.stl')
        bf = comp.features.baseFeatures.add()
        bf.name = 'Wood-grain mesh'
        bf.startEdit()
        try:
            meshes = comp.meshBodies.add(path, adsk.fusion.MeshUnits.MillimeterMeshUnit, bf)
            for i in range(meshes.count):
                meshes.item(i).name = name + '_woodgrain'
        finally:
            bf.finishEdit()

    def log_part(self, code, base, length, notches, kind, section):
        sec_set, rounded, grain, _ = LOG_SETS[self.part_set]
        sec = 'hex' if section == 'hex' else sec_set
        name = log_name(base, self.part_set)
        L = f'{code}_Length'
        if kind in ('log', 'half'):
            self.notch_params(code, length, notches)
        else:
            self.param(L, length, 'mm', 'Length' if kind == 'solid' else 'Length along the long edge', True)
        if kind == 'bevel':
            self.param(f'{code}_Angle', '39 deg', 'deg', 'Angle of the slanted end (roof pitch of the wooden triangle)', True)
        Lv = self.ev(L)
        at_end = lambda a, b: abs(a.z - b.z) < 1e-6 and (abs(a.z) < 1e-6 or abs(a.z - Lv) < 1e-6)
        at_bed = lambda a, b: abs(a.z) < 1e-6 and abs(b.z) < 1e-6

        def build(comp):
            if kind == 'log':
                body = self.section_body(comp, sec, L)
                if rounded:
                    self.round_ends(comp, body, at_end)
                self.notch_cuts(comp, code)
            elif kind == 'solid':
                # the solid-log STLs sit with the section's corner at the origin, so the section is centred on (R, R)
                body = self.section_body(comp, sec, L, centre=('LogDia / 2', 'LogDia / 2'))
                if rounded:
                    self.round_ends(comp, body, at_end)
            elif kind == 'bevel':
                body = self.section_body(comp, sec, L)
                if rounded:
                    self.round_ends(comp, body, at_bed)  # the square end only; the slanted end stays as cut
                c = Sk(self, comp, 'yz', 'Slant')
                c.poly([(neg('LogDia / 2'), L), ('LogDia / 2', L), (neg('LogDia / 2'), f'{L} - LogDia / tan({code}_Angle)')])
                self.extrude(comp, c.profiles(), 'LogDia + 4 mm', CUT, 'Slanted end', symmetric=True)
            else:  # half log, lying along X, flat side on the bed, notches on top
                s = Sk(self, comp, 'yz', 'Section')
                if sec == 'oct':
                    s.rect((neg('LogDia / 2'), neg('NotchDepth')), ('LogDia / 2', 'HalfLogHeight'))
                    body = self.extrude(comp, s.profiles(), L, NEW, 'Log').bodies.item(0)
                    self.octagon_corners(comp, edges_where(body, lambda a, b: abs(a.y - b.y) < 1e-6 and abs(a.z - b.z) < 1e-6))
                    bed = Sk(self, comp, 'yz', 'Bed')
                    bed.rect((neg('LogDia / 2 + 1 mm'), neg('NotchDepth + 1 mm')), ('LogDia / 2 + 1 mm', 0))
                    self.extrude(comp, bed.profiles(), L, CUT, 'Cut at the notch floor')
                else:
                    s.circle_on_bed('HalfLogHeight - LogDia / 2')
                    body = self.extrude(comp, [s.biggest()], L, NEW, 'Log').bodies.item(0)
                if rounded:
                    # both ends, all but the bottom edge, so the flat side stays on the bed
                    self.round_ends(comp, body, lambda a, b: abs(a.x - b.x) < 1e-6 and (abs(a.x) < 1e-6 or abs(a.x - Lv) < 1e-6) and b.z > 1e-6)
                n = Sk(self, comp, 'xz', 'Notch')
                n.rect((f'{code}_FirstNotch - NotchWidth / 2', 'HalfLogHeight - NotchDepth'),
                       (f'{code}_FirstNotch + NotchWidth / 2', 'HalfLogHeight + 1 mm'))
                cut = self.extrude(comp, n.profiles(), 'LogDia + 2 mm', CUT, 'Notch cut', symmetric=True)
                self.pattern(comp, cut, comp.xConstructionAxis, f'max({code}_Notches; 2)', f'{code}_NotchStep', 'Notch pattern')
            if grain and self.stl_dir:
                for b in comp.bRepBodies:
                    b.isLightBulbOn = False  # the parametric solid is kept, hidden; the textured mesh shows
                self.add_mesh(comp, name)

        self.part(name, build, place=base)

    # ---------- roof parts ----------
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

    def group_and_fit(self):
        # One timeline group per part, added last-to-first so earlier indices stay valid.
        try:
            tg = self.design.timeline.timelineGroups
            for name, a, b in reversed(self.groups):
                tg.add(a, b).name = name
        except Exception:
            self.errors.append(('timeline groups', traceback.format_exc()))
        self.app.activeViewport.fit()

    def build_logs(self):
        for name, expr, units, comment in LOG_PARAMS:
            self.param(name, expr, units, comment, True)
        self.param('HexDip', '0.7 mm', 'mm', 'Depth of the six flats on the hex log', True)
        if LOG_SETS[self.part_set][1]:
            self.param('EndRadius', '4 mm', 'mm', 'Radius of the rounded log ends', True)
        for args in LOGS:
            self.log_part(*args)
        self.group_and_fit()
        return self.errors

    def build_roof(self):
        for name, expr, units, comment in LOG_PARAMS + ROOF_PARAMS:
            self.param(name, expr, units, comment, True)
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

    def build(self):
        return self.build_roof() if self.part_set == 'roof_parts' else self.build_logs()


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

    def circle_at(self, centre, dia):
        """A circle of diameter dia with its centre at centre (a point given like the corners of rect)."""
        r = self.b.ev(dia) / 2
        c = self.sk.sketchCurves.sketchCircles.addByCenterRadius(self._p3(centre), r)
        self.pin(c.centerSketchPoint, centre)
        cg = c.centerSketchPoint.geometry
        self.sk.sketchDimensions.addDiameterDimension(c, P3(cg.x + r, cg.y + r, 0)).parameter.expression = dia
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


def build(app, part_set=PART_SET, stl_dir=None):
    """Build part_set into the active design. stl_dir: where the STLs are (default ../stl/<part_set> next to this file)."""
    if stl_dir is None and LOG_SETS.get(part_set, (0, 0, False))[2]:
        stl_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'stl', part_set)
    return Builder(app, part_set, stl_dir).build()


def run(context):
    app = adsk.core.Application.get()
    try:
        app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        errors = build(app)
        if errors:
            app.userInterface.messageBox('Finished with errors:\n\n' + '\n\n'.join(f'{n}:\n{t}' for n, t in errors))
    except Exception:
        app.userInterface.messageBox(traceback.format_exc())
