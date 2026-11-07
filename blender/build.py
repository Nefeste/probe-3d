# Зал пробы из Blender (docs/spec.md, «Сцена»): пол плиткой, три стены, колонны, скамейки, стойка, кадки с растениями.
# Как в «Больнице» (bolnitsa/blender): части — коробки и цилиндры из скрипта, затенение (AO) запекается Cycles в цвет
# вершин. Запуск: python blender/build.py (Blender как модуль Python: pip install bpy==4.5.15) или
# blender --background --factory-startup --python blender/build.py
#
# Пишет:
# - assets/models/hall.glb — модель как есть, для просмотра;
# - src/art/hall.gen.ts — треугольники для игры: позиции, нормаль грани, область палитры грани (src/art/palette.ts,
#   REGIONS) и затенение в каждой вершине. Сцены Three.js и запекание фона для Skia строятся из него.
#
# Оси. В игре x — вправо, y — вверх, z — к зрителю. В Blender вверх — Z; точка игры (x, y, z) в Blender — (x, −z, y).
# Повторяемость: случайности нет, запекание — в один поток с закреплённым зерном, числа округлены до 1e-4 и 1/255.
import math
import os
import sys

import bpy
import bmesh

VERSION = '4.5.15'
if bpy.app.version_string.split(' ')[0] != VERSION:
    sys.exit(f'нужен Blender {VERSION}, а это {bpy.app.version_string}')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Области палитры — тот же порядок, что REGIONS в src/art/palette.ts
REGIONS = ['floorA', 'floorB', 'wall', 'skirting', 'wood', 'metal', 'fabric', 'leaf', 'pot', 'desk']

# Зал: пол x −12…12, z −8…9; задняя стена высотой 3,2 м, боковые срезаны на 1 м (как стены «Больницы» в разрезе),
# спереди открыто — смотрим внутрь
HALL = {'x0': -12.0, 'x1': 12.0, 'z0': -8.0, 'z1': 9.0, 'h': 3.2, 'cut': 1.0, 'tile': 1.0}
AO_DISTANCE = 1.2
AO_SAMPLES = 64
AO_FLOOR = 0.4


def g2b(x, y, z):
    return (x, -z, y)


def b2g(v):
    return (v[0], v[2], -v[1])


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.seed = 0
    scene.cycles.use_denoising = False
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 1
    world = bpy.data.worlds.new('world')
    scene.world = world
    return scene


PARTS = []


def part(name, region, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for r in REGIONS:
        ob.data.materials.append(bpy.data.materials.get(r) or bpy.data.materials.new(r))
    for p in ob.data.polygons:
        p.material_index = REGIONS.index(region)
    PARTS.append(ob)
    return ob


def box(name, region, w, h, d, x, y, z, grid=0.5):
    """Коробка: размеры по осям игры, низ на y, середина в x, z; грани поделены сеткой — затенению есть где лечь."""
    bm = bmesh.new()
    nx, ny, nz = (max(1, math.ceil(s / grid)) for s in (w, h, d))
    sides = [
        # нормаль, ось a и её размер, ось b и её размер, толщина вдоль нормали, деления по a и b
        ((1, 0, 0), (0, 1, 0), (0, 0, 1), h, d, w, ny, nz),
        ((-1, 0, 0), (0, 1, 0), (0, 0, -1), h, d, w, ny, nz),
        ((0, 1, 0), (1, 0, 0), (0, 0, -1), w, d, h, nx, nz),
        ((0, -1, 0), (1, 0, 0), (0, 0, 1), w, d, h, nx, nz),
        ((0, 0, 1), (1, 0, 0), (0, 1, 0), w, h, d, nx, ny),
        ((0, 0, -1), (-1, 0, 0), (0, 1, 0), w, h, d, nx, ny),
    ]
    cx, cy, cz = x, y + h / 2, z
    for n, a, b, sa, sb, depth, na, nb in sides:
        # a, b — оси на грани; обход против часовой снаружи
        verts = []
        for i in range(na + 1):
            row = []
            for j in range(nb + 1):
                u = -sa / 2 + sa * i / na
                v = -sb / 2 + sb * j / nb
                p = [n[k] * depth / 2 + a[k] * u + b[k] * v for k in range(3)]
                row.append(bm.verts.new(g2b(cx + p[0], cy + p[1], cz + p[2])))
            verts.append(row)
        for i in range(na):
            for j in range(nb):
                f = bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]))
                f.normal_update()
                fn = b2g(f.normal)
                if fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2] < 0:
                    f.normal_flip()
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return part(name, region, bm)


def cylinder(name, region, r, h, x, y, z, sides=10, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts:
        bx, by, bz = v.co
        v.co = g2b(x + bx, y + h / 2 + bz, z - by)
    return part(name, region, bm)


def floor():
    bm = bmesh.new()
    t = HALL['tile']
    nx = int((HALL['x1'] - HALL['x0']) / t)
    nz = int((HALL['z1'] - HALL['z0']) / t)
    faces_a, faces_b = [], []
    for i in range(nx):
        for k in range(nz):
            x0 = HALL['x0'] + i * t
            z0 = HALL['z0'] + k * t
            vs = [bm.verts.new(g2b(x0, 0, z0 + t)), bm.verts.new(g2b(x0 + t, 0, z0 + t)),
                  bm.verts.new(g2b(x0 + t, 0, z0)), bm.verts.new(g2b(x0, 0, z0))]
            (faces_a if (i + k) % 2 == 0 else faces_b).append(bm.faces.new(vs))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    ob = part('floor', 'floorA', bm)
    for p in ob.data.polygons:
        c = b2g(p.center)
        i = int((c[0] - HALL['x0']) // t)
        k = int((c[2] - HALL['z0']) // t)
        p.material_index = REGIONS.index('floorA' if (i + k) % 2 == 0 else 'floorB')
    return ob


def hall():
    floor()
    H = HALL['h']
    w = HALL['x1'] - HALL['x0']
    d = HALL['z1'] - HALL['z0']
    zc = (HALL['z0'] + HALL['z1']) / 2
    box('wall_back', 'wall', w + 0.4, H, 0.2, 0, 0, HALL['z0'] - 0.1, grid=0.6)
    C = HALL['cut']
    box('wall_left', 'wall', 0.2, C, d, HALL['x0'] - 0.1, 0, zc, grid=0.6)
    box('wall_right', 'wall', 0.2, C, d, HALL['x1'] + 0.1, 0, zc, grid=0.6)
    box('skirt_back', 'skirting', w, 0.12, 0.04, 0, 0, HALL['z0'] + 0.02)
    box('skirt_left', 'skirting', 0.04, 0.12, d, HALL['x0'] + 0.02, 0, zc)
    box('skirt_right', 'skirting', 0.04, 0.12, d, HALL['x1'] - 0.02, 0, zc)
    # колонны
    for i, x in enumerate((-6.0, 0.0, 6.0)):
        box(f'pillar{i}', 'wall', 0.6, H, 0.6, x, 0, -2.5, grid=0.4)
    # скамейки вдоль задней стены
    for i, x in enumerate((-9.0, -3.0, 3.0, 9.0)):
        box(f'bench{i}_seat', 'wood', 2.2, 0.08, 0.5, x, 0.42, -7.3)
        box(f'bench{i}_back', 'wood', 2.2, 0.45, 0.06, x, 0.55, -7.55)
        for s in (-1, 1):
            box(f'bench{i}_leg{s}', 'metal', 0.06, 0.42, 0.45, x + s * 1.0, 0, -7.3)
    # стойка регистратуры справа
    box('desk', 'desk', 3.0, 1.05, 0.7, 7.5, 0, 3.2)
    box('desk_top', 'wood', 3.1, 0.05, 0.8, 7.5, 1.05, 3.2)
    # кадки с растениями
    for i, (x, z) in enumerate(((-11.0, -7.0), (11.0, -7.0), (-11.0, 4.5), (-4.0, 4.8))):
        cylinder(f'pot{i}', 'pot', 0.32, 0.55, x, 0, z, sides=10, r2=0.26)
        cylinder(f'plant{i}', 'leaf', 0.55, 1.3, x, 0.55, z, sides=7, r2=0.05)
    # кресла ожидания у колонн
    for i, x in enumerate((-4.5, -1.5, 1.5, 4.5)):
        box(f'chair{i}_seat', 'fabric', 0.55, 0.12, 0.55, x, 0.38, -1.2)
        box(f'chair{i}_back', 'fabric', 0.55, 0.5, 0.1, x, 0.5, -1.5)
        box(f'chair{i}_base', 'metal', 0.1, 0.38, 0.1, x, 0, -1.2)


def bake_ao():
    scene = bpy.context.scene
    scene.cycles.samples = AO_SAMPLES
    scene.world.light_settings.distance = AO_DISTANCE
    bpy.ops.object.select_all(action='DESELECT')
    for ob in PARTS:
        attr = ob.data.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER')
        ob.data.color_attributes.active_color = attr
        ob.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    scene.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    for ob in PARTS:
        for c in ob.data.color_attributes['ao'].data:
            v = AO_FLOOR + (1 - AO_FLOOR) * c.color[0]
            c.color = (v, v, v, 1.0)


def triangles():
    pos, nrm, reg, ao = [], [], [], []
    for ob in PARTS:
        me = ob.data
        me.calc_loop_triangles()
        col = me.color_attributes['ao'].data
        mw = ob.matrix_world
        for tri in me.loop_triangles:
            vs = [b2g(mw @ me.vertices[i].co) for i in tri.vertices]
            ax, ay, az = (vs[1][k] - vs[0][k] for k in range(3))
            bx, by, bz = (vs[2][k] - vs[0][k] for k in range(3))
            n = (ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
            ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1
            for v in vs:
                pos.extend(v)
            nrm.extend(c / ln for c in n)
            reg.append(tri.material_index)
            for li in tri.loops:
                ao.append(round(col[li].color[0] * 255))
    return pos, nrm, reg, ao


def fmt(xs):
    out = []
    for x in xs:
        s = ('%.4f' % round(x, 4)).rstrip('0').rstrip('.')
        out.append('0' if s in ('-0', '') else s)
    return ','.join(out)


def main():
    reset()
    hall()
    bake_ao()
    pos, nrm, reg, ao = triangles()
    os.makedirs(os.path.join(ROOT, 'assets', 'models'), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in PARTS:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'assets', 'models', 'hall.glb'), export_format='GLB',
                              use_selection=True, export_yup=True, export_vertex_color='ACTIVE', export_extras=False)
    lines = [
        '// Сделано blender/build.py (Blender ' + VERSION + ') — руками не править. Треугольники зала в осях игры: позиции по',
        '// три вершины; нормаль и область палитры (src/art/palette.ts, REGIONS) — по одной на треугольник; затенение (AO,',
        '// 0…255) — в каждой вершине.',
        'export const HALL = {',
        f'  pos: [{fmt(pos)}],',
        f'  nrm: [{fmt(nrm)}],',
        f'  reg: [{",".join(map(str, reg))}],',
        f'  ao: [{",".join(map(str, ao))}],',
        '} as const;',
        '',
    ]
    with open(os.path.join(ROOT, 'src', 'art', 'hall.gen.ts'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lines))
    print(f'зал: {len(reg)} треугольников')


main()
