"""
Gravity -- hero image renderer (Blender 4.2+/5.x, EEVEE Next, headless).

Builds a glowing 3D force-directed knowledge graph: one amber "your product"
core node, ~75 satellite nodes (companies / people / competitors / signals),
thin emissive edges, orbital rings, volumetric haze, depth of field and a
compositor bloom pass. No text is rendered -- text is overlaid later.

Usage:
  Blender -b --factory-startup --python gravity_hero.py -- \
      --hero  /path/hero-raw.png   [--hero-size 2400x1200] \
      --social /path/social-raw.png [--social-size 1200x630] \
      [--samples 64] [--engine EEVEE|CYCLES]
"""

import argparse
import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------
# Args
# --------------------------------------------------------------------------
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
here = os.path.dirname(os.path.abspath(__file__))
assets = os.path.dirname(here)
ap.add_argument("--hero", default=os.path.join(assets, "hero-raw.png"))
ap.add_argument("--social", default=os.path.join(assets, "social-raw.png"))
ap.add_argument("--hero-size", default="2400x1200")
ap.add_argument("--social-size", default="1200x630")
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--engine", default="EEVEE")
ap.add_argument("--only", default="both", choices=["both", "hero", "social"])
ap.add_argument("--seed", type=int, default=11)
args = ap.parse_args(argv)

T0 = time.time()


def log(*a):
    print(f"[gravity {time.time() - T0:6.1f}s]", *a, flush=True)


# --------------------------------------------------------------------------
# Palette (sRGB hex -> linear)
# --------------------------------------------------------------------------
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexlin(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b), a)


BG = hexlin("#07070c")
COL = {
    "core": hexlin("#ff9a1f"),
    "company": hexlin("#8b5cf6"),
    "people": hexlin("#22d3ee"),
    "competitor": hexlin("#f43f5e"),
    "signal": hexlin("#a3e635"),
}

# --------------------------------------------------------------------------
# Scene reset
# --------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "Gravity"

# --------------------------------------------------------------------------
# Graph topology + 3D force-directed layout (Fruchterman-Reingold)
# --------------------------------------------------------------------------
rng = np.random.default_rng(args.seed)

nodes = [("core", 1.0)]          # (category, radius)
edges = []                        # (a, b)


def add(cat, r):
    nodes.append((cat, r))
    return len(nodes) - 1


companies = [add("company", rng.uniform(0.24, 0.36)) for _ in range(20)]
competitors = [add("competitor", rng.uniform(0.26, 0.36)) for _ in range(8)]
people, signals = [], []

for c in companies:                       # ICP accounts hang off the product
    edges.append((0, c))
for k in competitors:                     # competitive landscape
    edges.append((0, k))
    for c in rng.choice(companies, size=int(rng.integers(1, 3)), replace=False):
        edges.append((k, int(c)))         # competitor is incumbent at account
for i in range(len(companies)):           # a few account-to-account links
    if rng.random() < 0.35:
        edges.append((companies[i], companies[(i + int(rng.integers(1, 5))) % len(companies)]))

for _ in range(30):                       # people work at companies
    p = add("people", rng.uniform(0.11, 0.17))
    people.append(p)
    edges.append((p, int(rng.choice(companies))))
    if rng.random() < 0.15:
        edges.append((p, int(rng.choice(companies))))

for _ in range(18):                       # buying signals on accounts / people
    s = add("signal", rng.uniform(0.08, 0.13))
    signals.append(s)
    pool = companies if rng.random() < 0.7 else (competitors if rng.random() < 0.4 else people)
    edges.append((s, int(rng.choice(pool))))

edges = list({tuple(sorted(e)) for e in edges if e[0] != e[1]})
N = len(nodes)
E = np.array(edges)
log(f"graph: {N} nodes, {len(edges)} edges")

pos = rng.normal(size=(N, 3)) * 3.0
pos[0] = 0
k = 1.9
temp = 1.2
for it in range(700):
    delta = pos[:, None, :] - pos[None, :, :]
    dist = np.linalg.norm(delta, axis=2) + 1e-6
    np.fill_diagonal(dist, np.inf)
    rep = (k * k / dist ** 2)
    rep[0, :] *= 5.0                     # the product node is "heavy"
    rep[:, 0] *= 5.0
    disp = (rep[:, :, None] * delta).sum(axis=1)
    d = pos[E[:, 0]] - pos[E[:, 1]]
    dl = np.linalg.norm(d, axis=1, keepdims=True) + 1e-6
    f = d * dl / k
    np.add.at(disp, E[:, 0], -f)
    np.add.at(disp, E[:, 1], f)
    disp -= 0.035 * pos * np.linalg.norm(pos, axis=1, keepdims=True)  # gravity well
    ln = np.linalg.norm(disp, axis=1, keepdims=True) + 1e-9
    pos += disp / ln * np.minimum(ln, temp)
    pos[0] = 0
    temp = max(0.01, temp * 0.993)

# Flatten into a gently tilted disc (galaxy-like), scale, keep clear of core.
pos[:, 2] *= 0.42
rxy = np.linalg.norm(pos[:, :2], axis=1)
pos *= 6.3 / np.percentile(rxy[1:], 96)
for i in range(1, N):
    r = np.linalg.norm(pos[i])
    if r < 2.3:
        pos[i] *= (2.3 + rng.uniform(0, 0.6)) / r
# Camera placement (needed here so nodes never sit in front of the core).
CAM_TARGET = Vector((0.0, 0.0, -0.3))
CAM_ELEV = math.radians(19)
CAM_AZIM = math.radians(-14)
CAM_DIST = 32.0
CAM_LOC = CAM_TARGET + Vector((CAM_DIST * math.cos(CAM_ELEV) * math.sin(CAM_AZIM),
                               -CAM_DIST * math.cos(CAM_ELEV) * math.cos(CAM_AZIM),
                               CAM_DIST * math.sin(CAM_ELEV)))
cl = np.array(CAM_LOC)
to_core = -cl / np.linalg.norm(cl)
core_ang = math.asin(1.9 / np.linalg.norm(cl))        # core + inner halo
for i in range(1, N):
    v = pos[i] - cl
    dv = np.linalg.norm(v)
    ang = math.acos(np.clip(np.dot(v / dv, to_core), -1, 1))
    if ang < core_ang:
        perp = v / dv - to_core * np.dot(v / dv, to_core)
        if np.linalg.norm(perp) < 1e-4:
            perp = np.array([1.0, 0.0, 0.0])
        perp /= np.linalg.norm(perp)
        pos[i] = pos[i] + perp * (core_ang * 1.25 - ang) * dv
log("layout done")

# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt


def mix_rgb_inputs(node):
    """Return (factor, A, B) sockets of a ShaderNodeMix in RGBA mode."""
    fac = node.inputs[0]
    cols = [s for s in node.inputs if s.type == "RGBA"]
    return fac, cols[0], cols[1]


def orb_material(name, color, strength, core_white=0.55, rim=0.25, jitter=0.45):
    """Glowing orb: hot near-white core fading to saturated colour at the rim."""
    m, nt = new_mat(name)
    N_ = nt.nodes
    L_ = nt.links
    out = N_.new("ShaderNodeOutputMaterial")
    em = N_.new("ShaderNodeEmission")
    lw = N_.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    inv = N_.new("ShaderNodeMath"); inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    L_.new(lw.outputs["Facing"], inv.inputs[1])            # 1 at centre, 0 at rim
    pw = N_.new("ShaderNodeMath"); pw.operation = "POWER"
    pw.inputs[1].default_value = 2.2
    L_.new(inv.outputs[0], pw.inputs[0])

    mix = N_.new("ShaderNodeMix"); mix.data_type = "RGBA"
    fac, a, b = mix_rgb_inputs(mix)
    a.default_value = color
    b.default_value = (1.0, 0.97, 0.92, 1.0)
    sc = N_.new("ShaderNodeMath"); sc.operation = "MULTIPLY"
    sc.inputs[1].default_value = core_white
    L_.new(pw.outputs[0], sc.inputs[0])
    L_.new(sc.outputs[0], fac)
    L_.new(next(o for o in mix.outputs if o.type == "RGBA"), em.inputs["Color"])

    # strength = base * (rim + (1-rim)*profile) * per-object random jitter
    prof = N_.new("ShaderNodeMath"); prof.operation = "MULTIPLY_ADD"
    prof.inputs[1].default_value = 1.0 - rim
    prof.inputs[2].default_value = rim
    L_.new(pw.outputs[0], prof.inputs[0])
    oi = N_.new("ShaderNodeObjectInfo")
    jit = N_.new("ShaderNodeMath"); jit.operation = "MULTIPLY_ADD"
    jit.inputs[1].default_value = jitter * 2
    jit.inputs[2].default_value = 1.0 - jitter
    L_.new(oi.outputs["Random"], jit.inputs[0])
    m1 = N_.new("ShaderNodeMath"); m1.operation = "MULTIPLY"
    L_.new(prof.outputs[0], m1.inputs[0]); L_.new(jit.outputs[0], m1.inputs[1])
    m2 = N_.new("ShaderNodeMath"); m2.operation = "MULTIPLY"
    m2.inputs[1].default_value = strength
    L_.new(m1.outputs[0], m2.inputs[0])
    L_.new(m2.outputs[0], em.inputs["Strength"])
    L_.new(em.outputs[0], out.inputs["Surface"])
    return m


def glow_shell_material(name, color, strength, power=3.0, alpha=0.6):
    """Additive halo shell: transparent + emission scaled by a fresnel falloff."""
    m, nt = new_mat(name)
    N_, L_ = nt.nodes, nt.links
    out = N_.new("ShaderNodeOutputMaterial")
    em = N_.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    tr = N_.new("ShaderNodeBsdfTransparent")
    lw = N_.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
    inv = N_.new("ShaderNodeMath"); inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    L_.new(lw.outputs["Facing"], inv.inputs[1])
    pw = N_.new("ShaderNodeMath"); pw.operation = "POWER"
    pw.inputs[1].default_value = power
    L_.new(inv.outputs[0], pw.inputs[0])
    mul = N_.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = alpha * strength
    L_.new(pw.outputs[0], mul.inputs[0])
    L_.new(mul.outputs[0], em.inputs["Strength"])
    # transparent + emission => purely additive glow, never occludes
    add = N_.new("ShaderNodeAddShader")
    L_.new(tr.outputs[0], add.inputs[0])
    L_.new(em.outputs[0], add.inputs[1])
    L_.new(add.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    try:
        m.use_transparency_overlap = False
    except Exception:
        pass
    return m


def line_material(name, color, strength, alpha=0.85):
    m, nt = new_mat(name)
    N_, L_ = nt.nodes, nt.links
    out = N_.new("ShaderNodeOutputMaterial")
    em = N_.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    em.inputs["Strength"].default_value = strength * alpha
    # Opaque emission: blended lines get swallowed by the blended halo shells
    # in EEVEE's sorted forward pass, so keep lines in the opaque pass.
    L_.new(em.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "DITHERED"
    return m


def dashed_ring_material(name, color, strength, dashes=96, duty=0.55):
    m, nt = new_mat(name)
    N_, L_ = nt.nodes, nt.links
    out = N_.new("ShaderNodeOutputMaterial")
    em = N_.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    tr = N_.new("ShaderNodeBsdfTransparent")
    tc = N_.new("ShaderNodeTexCoord")
    sep = N_.new("ShaderNodeSeparateXYZ")
    L_.new(tc.outputs["Object"], sep.inputs[0])
    at = N_.new("ShaderNodeMath"); at.operation = "ARCTAN2"
    L_.new(sep.outputs["Y"], at.inputs[0]); L_.new(sep.outputs["X"], at.inputs[1])
    mul = N_.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = dashes / (2 * math.pi)
    L_.new(at.outputs[0], mul.inputs[0])
    fr = N_.new("ShaderNodeMath"); fr.operation = "FRACT"
    L_.new(mul.outputs[0], fr.inputs[0])
    lt = N_.new("ShaderNodeMath"); lt.operation = "LESS_THAN"
    lt.inputs[1].default_value = duty
    L_.new(fr.outputs[0], lt.inputs[0])
    mix = N_.new("ShaderNodeMixShader")
    L_.new(lt.outputs[0], mix.inputs[0])
    L_.new(tr.outputs[0], mix.inputs[1])
    L_.new(em.outputs[0], mix.inputs[2])
    L_.new(mix.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "DITHERED"          # binary mask -> crisp dashes
    return m


MAT = {
    "core": orb_material("core", COL["core"], 1.55, core_white=0.28, rim=0.62, jitter=0.0),
    "company": orb_material("company", COL["company"], 2.0, core_white=0.06),
    "people": orb_material("people", COL["people"], 2.0, core_white=0.08),
    "competitor": orb_material("competitor", COL["competitor"], 2.4, core_white=0.12),
    "signal": orb_material("signal", COL["signal"], 2.2, core_white=0.15),
}
EDGE_MAT = {
    "core": line_material("edge_core", COL["core"], 2.4, 0.9),
    "company": line_material("edge_company", COL["company"], 3.2, 0.9),
    "people": line_material("edge_people", COL["people"], 1.5, 0.8),
    "competitor": line_material("edge_competitor", COL["competitor"], 2.8, 0.9),
    "signal": line_material("edge_signal", COL["signal"], 1.4, 0.8),
}

# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------
coll = scene.collection


def unit_sphere_mesh(name, seg=48, rings=24):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    return me


def link(obj):
    coll.objects.link(obj)
    return obj


SPHERE = {}
for cat in MAT:
    me = unit_sphere_mesh(f"sphere_{cat}", 64 if cat == "core" else 40, 32 if cat == "core" else 20)
    me.materials.append(MAT[cat])
    SPHERE[cat] = me

# Nodes
for i, (cat, r) in enumerate(nodes):
    ob = link(bpy.data.objects.new(f"node_{i:03d}_{cat}", SPHERE[cat]))
    ob.location = Vector(pos[i])
    r *= 0.88 if cat != "core" else 1.0
    ob.scale = (r, r, r)
    if cat == "core":
        ob.visible_shadow = False

# Core halo shells (soft atmospheric glow around "your product")
for j, (rad, st, pw, al) in enumerate([(1.3, 1.9, 1.5, 0.55), (2.2, 1.0, 2.4, 0.35), (3.8, 0.42, 3.0, 0.22)]):
    me = unit_sphere_mesh(f"halo_{j}", 64, 32)
    me.materials.append(glow_shell_material(f"halo_{j}", COL["core"], st, pw, al))
    ob = link(bpy.data.objects.new(f"halo_{j}", me))
    ob.scale = (rad, rad, rad)
    ob.visible_shadow = False


# Edges: one curve object per colour family, thin bevel
def edge_family(a, b):
    ca, cb = nodes[a][0], nodes[b][0]
    if "core" in (ca, cb):
        return cb if ca == "core" else ca
    order = ["signal", "competitor", "people", "company"]
    for o in order:
        if o in (ca, cb):
            return o
    return ca


curves = {}
for cat in EDGE_MAT:
    cu = bpy.data.curves.new(f"edges_{cat}", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.0095 if cat != "people" else 0.0075
    cu.bevel_resolution = 2
    cu.use_fill_caps = False
    cu.materials.append(EDGE_MAT[cat])
    curves[cat] = cu

packets = []
for a, b in edges:
    fam = edge_family(a, b)
    pa, pb = Vector(pos[a]), Vector(pos[b])
    dvec = (pb - pa)
    L = dvec.length
    if L < 1e-3:
        continue
    u = dvec / L
    sa = pa + u * nodes[a][1] * 0.98
    sb = pb - u * nodes[b][1] * 0.98
    sp = curves[fam].splines.new("POLY")
    sp.points.add(1)
    sp.points[0].co = (*sa, 1.0)
    sp.points[1].co = (*sb, 1.0)
    if rng.random() < 0.28:             # data packets travelling along edges
        t = rng.uniform(0.25, 0.75)
        packets.append((sa.lerp(sb, t), fam))

for cat, cu in curves.items():
    link(bpy.data.objects.new(f"edges_{cat}", cu))

# Packets: small hot dots along edges
for i, (p, fam) in enumerate(packets):
    ob = link(bpy.data.objects.new(f"packet_{i:02d}", SPHERE[fam]))
    ob.location = p
    s = 0.05
    ob.scale = (s, s, s)

# Orbital rings
def torus_mesh(name, R, r, seg=360, mseg=8):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(mseg):
            b = 2 * math.pi * j / mseg
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            ring.append(bm.verts.new((x, y, z)))
        verts.append(ring)
    for i in range(seg):
        for j in range(mseg):
            f = bm.faces.new((verts[i][j], verts[(i + 1) % seg][j],
                              verts[(i + 1) % seg][(j + 1) % mseg], verts[i][(j + 1) % mseg]))
            f.smooth = True
    bm.to_mesh(me)
    bm.free()
    return me


ring1 = link(bpy.data.objects.new("ring_inner", torus_mesh("ring_inner", 4.1, 0.011, seg=540)))
ring1.data.materials.append(line_material("ring_inner", COL["core"], 1.6, 0.7))
ring1.rotation_euler = (math.radians(4), math.radians(-6), 0)

ring2 = link(bpy.data.objects.new("ring_outer", torus_mesh("ring_outer", 6.4, 0.010, seg=720)))
ring2.data.materials.append(dashed_ring_material("ring_outer", COL["core"], 1.1, dashes=160, duty=0.42))
ring2.rotation_euler = (math.radians(-3), math.radians(5), math.radians(10))

ring3 = link(bpy.data.objects.new("ring_far", torus_mesh("ring_far", 8.8, 0.008, seg=720)))
ring3.data.materials.append(line_material("ring_far", hexlin("#8b5cf6"), 1.4, 0.4))
ring3.rotation_euler = (math.radians(7), math.radians(-2), 0)

# Background dust / distant nodes (one merged mesh per colour) for depth + bokeh
def dust_cloud(name, pts, radius_range, color, strength):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for p in pts:
        r = rng.uniform(*radius_range)
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r, matrix=Matrix.Translation(Vector(p)))
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    me.materials.append(orb_material(name, color, strength, core_white=0.3, rim=0.4, jitter=0.0))
    return link(bpy.data.objects.new(name, me))


def shell_points(n, rmin, rmax, zscale=0.55):
    v = rng.normal(size=(n, 3))
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    v *= rng.uniform(rmin, rmax, size=(n, 1))
    v[:, 2] *= zscale
    return v


cats = ["company", "people", "competitor", "signal"]
weights = [0.35, 0.35, 0.1, 0.2]
far = shell_points(260, 10.0, 32.0)
far[:, 1] = np.abs(far[:, 1]) + 2.0          # mostly behind the graph
choice = rng.choice(len(cats), size=len(far), p=weights)
for ci, c in enumerate(cats):
    dust_cloud(f"dust_{c}", far[choice == ci], (0.03, 0.08), COL[c], 1.1)

# --------------------------------------------------------------------------
# World: near-black + faint volumetric haze
# --------------------------------------------------------------------------
world = bpy.data.worlds.new("World")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
wn = world.node_tree.nodes
wl = world.node_tree.links
for n in list(wn):
    wn.remove(n)
wout = wn.new("ShaderNodeOutputWorld")
bgn = wn.new("ShaderNodeBackground")
bgn.inputs["Color"].default_value = BG
bgn.inputs["Strength"].default_value = 1.0
wl.new(bgn.outputs[0], wout.inputs["Surface"])
vol = wn.new("ShaderNodeVolumePrincipled")
vol.inputs["Density"].default_value = 0.0035
vol.inputs["Color"].default_value = (0.9, 0.9, 1.0, 1.0)
vol.inputs["Anisotropy"].default_value = 0.35
wl.new(vol.outputs[0], wout.inputs["Volume"])

# Lights only feed the haze (all surfaces are emission-only)
def point_light(name, loc, color, energy, radius=0.6):
    ld = bpy.data.lights.new(name, "POINT")
    ld.color = color[:3]
    ld.energy = energy
    ld.shadow_soft_size = radius
    ld.use_shadow = False
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = loc
    return ob


point_light("core_light", (0, 0, 0), COL["core"], 2600, 0.9)
point_light("violet_fill", (-4.0, 12.0, 3.0), COL["company"], 900, 2.0)
point_light("cyan_fill", (11.0, 8.0, -2.5), COL["people"], 500, 2.0)
point_light("rose_fill", (6.0, 16.0, 5.0), COL["competitor"], 350, 2.0)

# --------------------------------------------------------------------------
# Camera: slightly above, long lens, shallow DOF, graph pushed right
# --------------------------------------------------------------------------
camd = bpy.data.cameras.new("Camera")
camd.lens = 55
camd.sensor_width = 36
camd.sensor_fit = "HORIZONTAL"
camd.clip_end = 200
camd.shift_x = -0.195
camd.shift_y = 0.01
camd.dof.use_dof = True
camd.dof.aperture_fstop = 0.26
camd.dof.aperture_blades = 7
camd.dof.aperture_rotation = math.radians(12)
cam = link(bpy.data.objects.new("Camera", camd))
cam.location = CAM_LOC
cam.rotation_euler = (CAM_TARGET - cam.location).to_track_quat("-Z", "Y").to_euler()
camd.dof.focus_distance = (cam.location - Vector((0, 0, 0))).length
scene.camera = cam


# A few large out-of-focus foreground orbs (bokeh), placed in camera space
# as (u, v) frame fractions + depth so they always land in frame.
cam_mat = Matrix.Translation(cam.location) @ cam.rotation_euler.to_matrix().to_4x4()


def cam_point(u, v, depth, aspect=2.0):
    w = depth * camd.sensor_width / camd.lens
    x = (u - 0.5 + camd.shift_x) * w
    y = ((v - 0.5) / aspect + camd.shift_y) * w
    return cam_mat @ Vector((x, y, -depth))


fg_spec = [  # u, v (0=bottom), depth, category, radius
    (0.93, 0.16, 8.0, "people", 0.11),
    (0.80, 0.92, 9.5, "company", 0.12),
    (0.99, 0.60, 9.0, "signal", 0.08),
    (0.57, 0.06, 9.0, "competitor", 0.09),
    (0.71, 0.02, 12.0, "company", 0.09),
    (0.885, 0.98, 12.5, "people", 0.08),
    (0.42, 0.95, 14.0, "company", 0.07),
]
for i, (u, v, d, c, s) in enumerate(fg_spec):
    ob = link(bpy.data.objects.new(f"fg_{i}", SPHERE[c]))
    ob.location = cam_point(u, v, d)
    ob.scale = (s, s, s)

# --------------------------------------------------------------------------
# Render settings
# --------------------------------------------------------------------------
r = scene.render
engine = args.engine.upper()
if engine == "CYCLES":
    r.engine = "CYCLES"
    scene.cycles.samples = min(args.samples, 64)
    scene.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        log("cycles gpu setup failed:", e)
else:
    r.engine = "BLENDER_EEVEE"
    ee = scene.eevee
    ee.taa_render_samples = args.samples
    ee.volumetric_tile_size = "4"
    ee.volumetric_samples = 128
    ee.volumetric_start = 1.0
    ee.volumetric_end = 70.0
    ee.volumetric_light_clamp = 0.0
    ee.bokeh_max_size = 160
    ee.use_bokeh_jittered = True
    ee.use_shadows = False
    try:
        ee.use_raytracing = False
    except Exception:
        pass

r.film_transparent = False
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGB"
r.image_settings.color_depth = "8"
r.resolution_percentage = 100
r.use_compositing = True

vs = scene.view_settings
for vt in ("AgX", "Filmic", "Standard"):
    try:
        vs.view_transform = vt
        break
    except Exception:
        continue
for look in ("AgX - Punchy", "AgX - Medium High Contrast", "AgX - High Contrast", "Medium High Contrast", "None"):
    try:
        vs.look = look
        break
    except Exception:
        continue
vs.exposure = 0.0
vs.gamma = 1.0
log("view transform:", vs.view_transform, "| look:", vs.look)

# --------------------------------------------------------------------------
# Compositor: bloom + soft fog glow + whisper of chromatic dispersion
# --------------------------------------------------------------------------
def setup_compositor():
    if hasattr(scene, "compositing_node_group"):          # Blender 5.x API
        ng = bpy.data.node_groups.new("GravityComp", "CompositorNodeTree")
        ng.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        out = ng.nodes.new("NodeGroupOutput")
        out_sock = out.inputs[0]
        scene.compositing_node_group = ng
    else:                                                 # Blender 4.x API
        scene.use_nodes = True
        ng = scene.node_tree
        for n in list(ng.nodes):
            ng.nodes.remove(n)
        out = ng.nodes.new("CompositorNodeComposite")
        out_sock = out.inputs["Image"]
    rl = ng.nodes.new("CompositorNodeRLayers")

    def glare(kind, threshold, strength, size, quality="High"):
        g = ng.nodes.new("CompositorNodeGlare")
        if "Type" in g.inputs:                            # 4.4+/5.x socket API
            g.inputs["Type"].default_value = kind
            g.inputs["Quality"].default_value = quality
            g.inputs["Threshold"].default_value = threshold
            g.inputs["Strength"].default_value = strength
            g.inputs["Size"].default_value = size
        else:
            g.glare_type = kind.upper().replace(" ", "_")
            g.quality = quality.upper()
            g.threshold = threshold
            g.mix = strength - 1.0
            g.size = int(4 + size * 5)
        return g

    bloom = glare("Bloom", 0.5, 0.7, 0.8)
    fog = glare("Fog Glow", 0.9, 0.25, 0.5)
    ng.links.new(rl.outputs["Image"], bloom.inputs["Image"])
    ng.links.new(bloom.outputs["Image"], fog.inputs["Image"])
    last = fog.outputs["Image"]
    try:
        ld = ng.nodes.new("CompositorNodeLensdist")
        ld.inputs["Dispersion"].default_value = 0.012
        if "Distortion" in ld.inputs:
            ld.inputs["Distortion"].default_value = 0.0
        ng.links.new(last, ld.inputs["Image"])
        last = ld.outputs["Image"]
    except Exception as e:
        log("lens distortion skipped:", e)
    ng.links.new(last, out_sock)
    log("compositor ready")


try:
    setup_compositor()
except Exception as e:
    log("compositor setup failed (continuing without bloom):", e)
    r.use_compositing = False

# --------------------------------------------------------------------------
# Render
# --------------------------------------------------------------------------
def render(path, size):
    w, h = (int(v) for v in size.lower().split("x"))
    r.resolution_x, r.resolution_y = w, h
    r.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    log(f"rendered {w}x{h} -> {path} in {time.time() - t:.1f}s")


os.makedirs(os.path.dirname(os.path.abspath(args.hero)), exist_ok=True)
if args.only in ("both", "hero"):
    render(args.hero, args.hero_size)
if args.only in ("both", "social"):
    render(args.social, args.social_size)
log("done")
