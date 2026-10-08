import { describe, expect, it, vi } from 'vitest';
import * as apiMetadata from '@engine/runtime/ApiMetadata';
import { adapterMap, supportedPreviewApiNames } from '@engine/geometry/adapters/apiAdapters';
import { buildConnectorPreview } from '@engine/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '@engine/geometry/PreviewGeometryEngine';
import type { PreviewMesh } from '@engine/geometry/previewScene';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import { RuntimeArray } from '@engine/runtime/RuntimeValue';
import { what } from '@engine/runtime/cpp/cpp';
import { cross, dot, DVec3, length as vectorLength } from '@engine/math/DVec3';
import { decodeResult, encodeConnector, encodeScene, type Json } from '@tests/support/codec';
import { expectSameJson } from '@tests/support/compare';
import { expectFiniteScene } from '@tests/support/finiteScene';
import { connectorDefinition, isLiteral, literalEvaluator } from '@tests/support/connectors';
import { expectedOutput } from '@tests/support/expected';
import { listFixtures } from '@tests/support/fixtures';

const kX = new DVec3(1, 0, 0);

// The area of each triangle, positive when it faces `normal`.
const triangleAreas = (mesh: PreviewMesh, normal: DVec3): number[] => {
  const points = mesh.vertices.map((v) => new DVec3(v.x, v.y, v.z));

  return Array.from({ length: mesh.indices.length / 3 }, (_, t) => {
    const [a, b, c] = mesh.indices.slice(3 * t, 3 * t + 3).map((index) => points[index]);

    return dot(cross(b.sub(a), c.sub(a)), normal) / 2;
  });
};

const signedArea = (mesh: PreviewMesh, normal: DVec3): number =>
  triangleAreas(mesh, normal).reduce((sum, area) => sum + area, 0);

const boundaryLoops = (mesh: PreviewMesh) => {
  const edges = new Map<string, [number, number, number]>();
  for (let i = 0; i < mesh.indices.length; i += 3)
    for (let j = 0; j < 3; ++j) {
      const a = mesh.indices[i + j],
        b = mesh.indices[i + ((j + 1) % 3)];
      const key = [a, b].sort((x, y) => x - y).join(',');
      const entry = edges.get(key) ?? [a, b, 0];
      ++entry[2];
      edges.set(key, entry);
    }
  const boundary = new Map<number, number[]>();
  for (const [a, b, count] of edges.values()) {
    expect(count).toBeLessThanOrEqual(2);
    if (count !== 1) continue;
    boundary.set(a, [...(boundary.get(a) ?? []), b]);
    boundary.set(b, [...(boundary.get(b) ?? []), a]);
  }
  const seen = new Set<number>();
  let loops = 0;
  for (const start of boundary.keys()) {
    if (seen.has(start)) continue;
    ++loops;
    const pending = [start];
    while (pending.length) {
      const v = pending.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      const neighbors = boundary.get(v)!;
      expect(neighbors).toHaveLength(2);
      pending.push(...neighbors.filter((p) => !seen.has(p)));
    }
  }

  return loops;
};

describe('makeKFSymbolFlat layout', () => {
  it.each([
    [7, 0],
    [8, 1],
    [10, 1],
    [13, 1],
    [21, 2],
    [26, 2],
  ])('fits symbols without requiring a trailing gap (width=%s)', (width, count) => {
    const result = new GeometryRuntime().executeUpToLine(
      `makeKFSymbolFlat(FdPoint3d(), vz, vx, ${width}, 5, 8, 5, 0, 5, 5);`,
      999,
    );
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(count);
    for (const mesh of scene.meshes) expect(mesh.indices.length).toBeGreaterThan(0);
    expectFiniteScene(scene);
  });

  it.each([
    [0, 0, 4],
    [0, 4, 3],
    [5, 0, 2],
    [14, 0, 0],
  ])('accounts for row offsets (start=%s, alternating=%s)', (start, offset, count) => {
    const result = new GeometryRuntime().executeUpToLine(
      `makeKFSymbolFlat(FdPoint3d(), vz, vx, 21, 15, 8, 5, ${offset}, 5, 5, ${start});`,
      999,
    );
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(count);
    expectFiniteScene(scene);
  });
});

describe('framed rectangular grills', () => {
  const build = (code: string) => {
    const result = new GeometryRuntime().executeUpToLine(code, 999);
    expect(result.diagnostics).toEqual([]);

    return new PreviewGeometryEngine().build(result);
  };

  it.each([1, 4, 20, 300])('Type6 makes %s holes of width a and a complete frame', (n) => {
    const a = 50 / n;
    const scene = build(`makeGrillType6(FdPoint3d(),vz,vy,200,100,${n},${a});`);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    const mesh = scene.meshes[0];
    expect(boundaryLoops(mesh)).toBe(n + 1);
    expect(Math.min(...mesh.vertices.map((p) => p.x))).toBe(-130);
    expect(Math.max(...mesh.vertices.map((p) => p.x))).toBe(130);
    expect(Math.min(...mesh.vertices.map((p) => p.y))).toBe(-80);
    expect(Math.max(...mesh.vertices.map((p) => p.y))).toBe(80);
    expect(mesh.vertices.every((p) => p.z === 0)).toBe(true);
    expect([...new Set(mesh.vertices.map((p) => p.x))].sort((x, y) => x - y)).toEqual([-130, -100, 100, 130]);
    expect(signedArea(mesh, new DVec3(0, 0, 1))).toBeCloseTo(260 * 160 - n * a * 200, 1);
    const rows = [...new Set(mesh.vertices.map((p) => p.y))].sort((x, y) => x - y);
    expect(rows[1]).toBe(-50);
    expect(rows.at(-2)).toBe(50);
    for (let i = 0; i < n; ++i) expect(rows[2 * i + 3] - rows[2 * i + 2]).toBeCloseTo(a, 4);
  });

  it.each([
    [260, 660],
    [400, 320],
  ])('Type6 covers the F x A opening with reduced slat dimensions (F=%s, A=%s)', (f, a) => {
    const scene = build(`double F=${f}, A=${a}; makeGrillType6(FdPoint3d(),vx,F-60,A-60,20,5);`);
    expect(scene.warnings).toEqual([]);
    const mesh = scene.meshes[0],
      vertices = mesh.vertices;
    expect(boundaryLoops(mesh)).toBe(21);
    expect(vertices.every((p) => p.x === 0)).toBe(true);
    expect(Math.min(...vertices.map((p) => p.y))).toBe(-a / 2);
    expect(Math.max(...vertices.map((p) => p.y))).toBe(a / 2);
    expect(Math.min(...vertices.map((p) => p.z))).toBe(-f / 2);
    expect(Math.max(...vertices.map((p) => p.z))).toBe(f / 2);
    const rows = [...new Set(vertices.map((p) => p.y))].sort((x, y) => x - y);
    expect(rows[1]).toBe(-(a - 60) / 2);
    expect(rows.at(-2)).toBe((a - 60) / 2);
    expect([...new Set(vertices.map((p) => p.z))].sort((x, y) => x - y)).toEqual([
      -f / 2,
      -(f - 60) / 2,
      (f - 60) / 2,
      f / 2,
    ]);
    for (let i = 0; i < 20; ++i) expect(rows[2 * i + 3] - rows[2 * i + 2]).toBeCloseTo(5, 4);
  });

  it('keeps narrow Type6 slats at the supplied length with the frame entirely outside', () => {
    const scene = build('makeGrillType6(FdPoint3d(),vz,vy,10,100,1,5);');
    expect(scene.warnings).toEqual([]);
    const mesh = scene.meshes[0];
    expect(boundaryLoops(mesh)).toBe(2);
    expect([...new Set(mesh.vertices.map((p) => p.x))].sort((x, y) => x - y)).toEqual([-35, -5, 5, 35]);
    expect(signedArea(mesh, new DVec3(0, 0, 1))).toBeCloseTo(70 * 160 - 10 * 5);
  });

  it('keeps the zero-width-hole solid plate used by makeGrPPD1', () => {
    const scene = build('makeGrillType6(FdPoint3d(),vz,vy,200,100,2,0);');
    expect(scene.warnings).toEqual([]);
    expect(boundaryLoops(scene.meshes[0])).toBe(1);
    expect(signedArea(scene.meshes[0], new DVec3(0, 0, 1))).toBe(41600);
  });

  it.each([1, 3, 20, 300])('Type7 makes %s angled blades with the specified normal depth', (n) => {
    const scene = build(`makeGrillType7(FdPoint3d(),vz,vy,200,100,${n},30,10);`);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    const mesh = scene.meshes[0];
    let blades = 0,
      frame = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index]);
      if (points.every((p) => p.z === 0)) {
        ++frame;
        continue;
      }
      ++blades;
      const p = points[0];
      expect(Math.min(...points.map((v) => v.x))).toBe(-100);
      expect(Math.max(...points.map((v) => v.x))).toBe(100);
      expect((Math.acos(p.nz) * 180) / Math.PI).toBeCloseTo(30, 4);
      expect(Math.min(...points.map((v) => v.z))).toBe(0);
      expect(Math.max(...points.map((v) => v.z))).toBe(10);
    }
    expect(blades).toBe(2 * n);
    expect(frame).toBe(16);
    expect(Math.min(...mesh.vertices.map((p) => p.x))).toBe(-130);
    expect(Math.max(...mesh.vertices.map((p) => p.x))).toBe(130);
    expect(Math.min(...mesh.vertices.map((p) => p.y))).toBe(-80);
    expect(Math.max(...mesh.vertices.map((p) => p.y))).toBe(80);
    expect(mesh.vertices.every((p) => p.z >= 0 && p.z <= 10)).toBe(true);
    expect(mesh.vertices.filter((p) => p.z > 0).every((p) => Math.abs(p.x) <= 100 && Math.abs(p.y) <= 50)).toBe(true);
    expectFiniteScene(scene);
  });

  it.each(['vx', 'vy', 'vz', '-vx', '-vz', 'FdVector3d(1,2,3)'])(
    'matches implicit and explicit upVector for %s',
    (axis) => {
      for (const [api, args] of [
        ['makeGrillType6', '200,100,3,10'],
        ['makeGrillType7', '200,100,3,30,10'],
      ]) {
        const implicit = build(`FdVector3d axis=${axis}; ${api}(FdPoint3d(5,7,9),axis,${args});`);
        const explicit = build(`FdVector3d axis=${axis}; ${api}(FdPoint3d(5,7,9),axis,axis.perpVector(),${args});`);
        expect(implicit.warnings).toEqual([]);
        expect(explicit.warnings).toEqual([]);
        expect(implicit.meshes).toEqual(explicit.meshes);
      }
    },
  );

  it.each([1, 2, 3, 4, 5, 6, 7])('makeRectGrillType%s preserves the optional closeLast frame', (type) => {
    const args = `FdPoint3d(),vz,vy,200,100,5,30,10,4,${type === 7 ? '3,' : ''}10`;
    const omitted = build(`makeRectGrillType${type}(${args});`);
    const open = build(`makeRectGrillType${type}(${args},false);`);
    const closed = build(`makeRectGrillType${type}(${args},true);`);
    expect(omitted).toEqual(open);
    for (const scene of [omitted, open, closed]) {
      expect(scene.warnings).toEqual([]);
      expect(scene.meshes.length).toBeGreaterThan(0);
      let hasFrame = false;
      for (const mesh of scene.meshes) {
        const width = Math.max(...mesh.vertices.map((p) => p.x)) - Math.min(...mesh.vertices.map((p) => p.x));
        const height = Math.max(...mesh.vertices.map((p) => p.y)) - Math.min(...mesh.vertices.map((p) => p.y));
        hasFrame ||= width > 199 && height > 99;
      }
      expect(hasFrame).toBe(scene === closed);
      expectFiniteScene(scene);
    }
  });

  it.each([
    'makeGrillType6(FdPoint3d(),vz,200,100,20,5);',
    'makeGrillType6(FdPoint3d(),vz,200,100,20,-1);',
    'makeGrillType7(FdPoint3d(),vz,200,100,3,0,10);',
    'makeGrillType7(FdPoint3d(),vz,200,100,3,90,10);',
    'makeGrillType7(FdPoint3d(),vz,200,100,3,30,100);',
  ])('warns for invalid grille parameters: %s', (code) => {
    const scene = build(code);
    expect(scene.warnings).toHaveLength(1);
    expect(scene.meshes).toEqual([]);
  });
});

describe('grille SDK shapes and overloads', () => {
  const build = (code: string) => {
    const result = new GeometryRuntime().executeUpToLine(code, 999);
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expectFiniteScene(scene);

    return scene;
  };

  const geometry = (code: string) => build(code).meshes.map(({ vertices, indices }) => ({ vertices, indices }));

  it.each([4, 10])('Type1 builds twelve fan blades for makeAQ with complexity %s', (n) => {
    const scene = build(`double L=800; FdPoint3d cp1(-5,0,0); makeGrillType1(cp1,vz,L/100,L-380,L-380,10,${n},12);`);
    const mesh = scene.meshes[0];
    expect(scene.meshes).toHaveLength(1);
    const blades = mesh.vertices.filter((p) => -p.nx < 0.999);
    expect(blades).toHaveLength(12 * 4);
    const normals = new Set(blades.map((p) => [p.nx, p.ny, p.nz].map((v) => v.toFixed(5)).join(',')));
    expect(normals.size).toBe(12);
    for (const p of blades) {
      expect(-p.nx).toBeCloseTo(Math.cos(Math.PI / 18), 5);
      const radius = Math.hypot(p.x + 5, p.y, p.z);
      expect(Math.min(Math.abs(radius - 4), Math.abs(radius - 210))).toBeLessThan(0.0001);
    }
    expect(mesh.indices.length / 3).toBe(4 * n + 24);
    // The inlet runs along X: the grille fills its YZ section, with only blade pitch along X.
    expect(Math.max(...mesh.vertices.map((p) => p.x))).toBeCloseTo(-5);
    expect(-5 - Math.min(...mesh.vertices.map((p) => p.x))).toBeCloseTo(
      210 * Math.sin(Math.PI / 6) * Math.sin(Math.PI / 18),
      4,
    );
    for (const coordinate of ['y', 'z'] as const) {
      expect(Math.min(...mesh.vertices.map((p) => p[coordinate]))).toBeCloseTo(-210);
      expect(Math.max(...mesh.vertices.map((p) => p[coordinate]))).toBeCloseTo(210);
    }
  });

  it.each([
    ['vx', 'vz', new DVec3(0, 0, 1)],
    ['vy', '-vx', new DVec3(-1, 0, 0)],
    ['FdVector3d(2,1,0)', 'FdVector3d(0,0,4)', new DVec3(0, 0, 1)],
    ['FdVector3d(1,1,0)', 'FdVector3d(1,-1,2)', new DVec3(1, -1, 2).mul(1 / Math.sqrt(6))],
  ])('Type1 uses upVector as its axis (%s, %s)', (vector, upVector, axis) => {
    const center = new DVec3(5, 7, 9);
    const mesh = build(`makeGrillType1(FdPoint3d(5,7,9),${vector},${upVector},40,80,120,30,8,6);`).meshes[0];
    let bladeVertices = 0;
    for (const p of mesh.vertices) {
      const direction = dot(new DVec3(p.nx, p.ny, p.nz), axis);
      if (direction > 0.999) {
        expect(dot(new DVec3(p.x, p.y, p.z).sub(center), axis)).toBeCloseTo(0, 5);
      } else {
        expect(direction).toBeCloseTo(Math.cos(Math.PI / 6), 5);
        ++bladeVertices;
      }
    }
    expect(bladeVertices).toBe(6 * 4);
  });

  it.each(['vx', 'vz', '-vz', 'FdVector3d(1,2,3)'])(
    'grille overloads use the same perpendicular frame for %s',
    (axis) => {
      for (const [name, args] of [
        ['makeGrillType1', '40,80,120,30,8,6'],
        ['makeGrillType4', '40,80,120,30,2,8,6,true,200,160'],
        ['makeGrillType5', '80,120,8,6,30'],
        ['makeGrillType6', '200,160,8,5'],
        ['makeGrillType7', '200,160,8,30,12'],
      ]) {
        const prefix = `FdVector3d axis=${axis}; `;
        expectSameJson(
          geometry(prefix + `${name}(FdPoint3d(5,7,9),axis,${args});`),
          geometry(prefix + `${name}(FdPoint3d(5,7,9),axis,axis.perpVector(),${args});`),
          { tolerance: 1e-12, looseTolerance: 1e-12 },
        );
      }
    },
  );

  it('Type2 independently applies height, flange height and the central cover flag', () => {
    for (const d of [12, 25])
      for (const flange of [3, 8])
        for (const cap of [false, true]) {
          const mesh = build(`makeGrillType2(FdPoint3d(),vz,40,80,120,8,${d},${flange},${cap});`).meshes[0];
          expect(Math.min(...mesh.vertices.map((p) => p.z))).toBe(-flange);
          expect(Math.max(...mesh.vertices.map((p) => p.z))).toBe(d);
          const capTriangles = Array.from({ length: mesh.indices.length / 3 }, (_, i) =>
            mesh.indices.slice(i * 3, i * 3 + 3).map((j) => mesh.vertices[j]),
          ).filter((points) => points.every((p) => p.z === d));
          expect(capTriangles).toHaveLength(cap ? 32 : 0);
        }
  });

  it('Type3 follows the separate top spacing and bladeHeight shown in the section drawing', () => {
    const mesh = build('makeGrillType3(FdPoint3d(),vz,40,80,120,8,3,7,12);').meshes[0];
    expect([...new Set(mesh.vertices.map((p) => p.z))].sort((a, b) => a - b)).toEqual([-7, -1, 0, 5, 6, 12]);
    expect(mesh.indices.length / 3).toBe(32 * (2 + 3 * 2 + 1));
  });

  it.each([false, true])('Type4 cuts six open slots in the plate (rect=%s)', (rect) => {
    const mesh = build(`makeGrillType4(FdPoint3d(),vz,vy,40,80,120,30,2,8,6,${rect},200,160);`).meshes[0];
    expect(boundaryLoops(mesh)).toBe(7);
    expect(mesh.vertices.every((p) => p.z === 0)).toBe(true);
    expect(Math.max(...mesh.vertices.map((p) => p.x))).toBe(rect ? 100 : 60);
    expect(Math.max(...mesh.vertices.map((p) => p.y))).toBe(rect ? 80 : 60);
    expect(triangleAreas(mesh, new DVec3(0, 0, 1)).every((area) => area > 0)).toBe(true);
    const area = signedArea(mesh, new DVec3(0, 0, 1));
    const span = -21 * Math.cos(Math.PI / 6) + Math.sqrt(39 ** 2 - 21 ** 2 * Math.sin(Math.PI / 6) ** 2);
    const plate = rect ? 200 * 160 : (32 / 2) * 60 ** 2 * Math.sin((2 * Math.PI) / 32);
    expect(area).toBeCloseTo(plate - 6 * 2 * span, 2);
  });

  it('Type4 honors L/H only in rectangular mode and rejects holes that cannot fit', () => {
    const prefix = 'makeGrillType4(FdPoint3d(),vz,vy,40,80,120,30,2,8,6,';
    expect(geometry(prefix + 'false,200,160);')).toEqual(geometry(prefix + 'false,300,240);'));
    expect(geometry(prefix + 'true,200,160);')).not.toEqual(geometry(prefix + 'true,300,240);'));
    const result = new GeometryRuntime().executeUpToLine(prefix + 'true,10,10);', 999);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.meshes).toEqual([]);
    expect(scene.warnings).toHaveLength(1);
  });

  it.each([
    'makeGrillType1(FdPoint3d(),vz,40,80,120,30,8,2);',
    'makeGrillType4(FdPoint3d(),vz,40,80,120,30,2,8,3);',
    'makeGrillType4(FdPoint3d(),vz,40,80,120,30,30,8,6);',
  ])('invalid blade or slot parameters do not leave partial geometry: %s', (code) => {
    const result = new GeometryRuntime().executeUpToLine(code, 999);
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.meshes).toEqual([]);
    expect(scene.warnings).toHaveLength(1);
  });

  it.each([3, 6])('Type5 makes %s parallel blades plus two end blades', (m) => {
    const meshes = build(`makeGrillType5(FdPoint3d(),vz,vy,80,120,8,${m},30);`).meshes;
    const vertices = meshes.flatMap((mesh) => mesh.vertices).filter((p) => p.nz < 0.999);
    const roots = new Set(vertices.map((p) => (p.y - p.z / Math.tan(Math.PI / 6)).toFixed(4)));
    expect(roots.size).toBe(m + 2);
    for (const p of vertices) expect(p.nz).toBeCloseTo(Math.cos(Math.PI / 6), 5);
  });

  it('simple grilles honor main and circular cpx without changing the diameter', () => {
    for (const api of ['makeRectSimpleGrill', 'makeCircSimpleGrill']) {
      const args = api === 'makeRectSimpleGrill' ? '200,100' : '100,8';
      const prefix = `${api}(FdPoint3d(),vz,${args}`;
      expect(geometry(prefix + ');')).toEqual(geometry(prefix + ',true);'));
      expect(geometry(prefix + ',true);')).not.toEqual(geometry(prefix + ',false);'));
    }
    const low = build('makeCircSimpleGrill(FdPoint3d(),vz,100,4);'),
      high = build('makeCircSimpleGrill(FdPoint3d(),vz,100,12);');
    expect(high.meshes.flatMap((m) => m.indices).length).toBeGreaterThan(low.meshes.flatMap((m) => m.indices).length);
  });
});

describe('makeBUTTV tube intersection boundary', () => {
  it.each([56, 56.0001, -56, -56.0001])('builds both sides when the duct reaches the radius (%s)', (length) => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      `
FdPoint3d start(0,0,16);
double tube[3] = {112,112,32};
double position[2] = {16,0};
double duct[3] = {32,69.28,${length}};
makeRectToTubeIntersection(start, -vz, -vx, tube, position, duct, 5);
makeRectToTubeIntersection(start, -vz, vx, tube, position, duct, 5);`,
      999,
    );
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(4);
    expectFiniteScene(scene);
    for (const mesh of scene.meshes) {
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices.slice(i, i + 3).map((j) => {
          const v = mesh.vertices[j];

          return new DVec3(v.x, v.y, v.z);
        });
        expect(vectorLength(cross(b.sub(a), c.sub(a)))).toBeGreaterThan(0);
      }
    }
  });

  it('still rejects a duct shorter than the radius', () => {
    const result = new GeometryRuntime().executeUpToLine(
      `
double tube[3]={112,112,32}, position[2]={16,0}, duct[3]={32,69.28,55.9999};
makeRectToTubeIntersection(FdPoint3d(0,0,16), -vz, -vx, tube, position, duct, 5);`,
      999,
    );
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.meshes).toEqual([]);
    expect(scene.warnings).toHaveLength(1);
    expect(scene.warnings[0]).toContain('ductLength must reach diamB/2');
  });
});

describe('makeEllipticalPlane', () => {
  const build = (source: string) => {
    const result = new GeometryRuntime().executeUpToLine(source, 999);
    expect(result.diagnostics).toEqual([]);

    return new PreviewGeometryEngine().build(result);
  };

  it.each([5, 10])('keeps the hole and the SDK bend orientation (n=%s)', (count) => {
    const scene = build(`
double B = 435, BG_d = 7;
FdPoint3d cP(0, 0, 0);
cP.z += 0.5 * BG_d;
makeEllipticalPlane(cP, vz, vx, 0.5 * (B - 50), 0.5 * B, ${count});`);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    const [mesh] = scene.meshes;
    expect(mesh.vertices).toHaveLength(2 * count);
    expect(mesh.indices).toHaveLength(6 * count);
    // makeBend starts on -vector.crossProduct(upVector), around the supplied center.
    expect(mesh.vertices[0]).toMatchObject({ x: 0, y: -192.5, z: 3.5 });
    expect(mesh.vertices[1]).toMatchObject({ x: 0, y: -217.5, z: 3.5 });
    for (const v of mesh.vertices) {
      expect(v.x).toBe(0);
      expect([v.nx, v.ny, v.nz]).toEqual([1, 0, 0]);
      expect(Math.min(...[192.5, 217.5].map((r) => Math.abs(Math.hypot(v.y, v.z - 3.5) - r)))).toBeLessThan(0.0001);
    }
    for (const area of triangleAreas(mesh, kX)) expect(area).toBeGreaterThan(0);
    // Area of the outer regular polygon minus the inner one; a filled fan fails this.
    expect(signedArea(mesh, kX)).toBeCloseTo(
      (count / 2) * Math.sin((2 * Math.PI) / count) * (217.5 ** 2 - 192.5 ** 2),
      1,
    );
  });

  it('uses the existing perpendicular-vector convention for the overload without upVector', () => {
    const scene = build(`
FdPoint3d center(5, 1, 3);
makeEllipticalPlane(center, vx, 40.5, 45.5, 4);
makeEllipticalPlane(center, vx, vx.perpVector(), 40.5, 45.5, 4);`);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(2);
    expect(scene.meshes[0].vertices).toEqual(scene.meshes[1].vertices);
    expect(scene.meshes[0].indices).toEqual(scene.meshes[1].indices);
    expect(scene.meshes[0].vertices[0]).toMatchObject({ x: 5, y: 1, z: 43.5 });
  });

  it('keeps upVector as the plane normal even when vector has an out-of-plane component', () => {
    const scene = build('makeEllipticalPlane(FdPoint3d(5,1,3), FdVector3d(2,0,1), FdVector3d(0,0,7), 2, 4, 4);');
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    for (const v of scene.meshes[0].vertices) {
      expect(v.z).toBe(3);
      expect([v.nx, v.ny, v.nz]).toEqual([0, 0, 1]);
    }
  });

  it.each([
    ['vz, vx, 0, 4', 'R1 must be positive'],
    ['vz, vx, 4, 4', 'R2 must be greater than R1'],
    ['vz, vx, 5, 4', 'R2 must be greater than R1'],
    ['vz, vz, 2, 4', 'vector and upVector must be nonzero and nonparallel'],
  ])('rejects invalid geometry (%s)', (args, warning) => {
    const scene = build(`makeEllipticalPlane(FdPoint3d(0,0,0), ${args}, 4);`);
    expect(scene.meshes).toEqual([]);
    expect(scene.warnings).toEqual([`line 1 makeEllipticalPlane: ${warning}`]);
  });
});

describe('makeBox clockwise side flags', () => {
  const build = (source: string) => {
    const result = new GeometryRuntime().executeUpToLine(source, 999);
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expectFiniteScene(scene);

    return scene.meshes[0];
  };

  it.each([
    ['vz', 'vy', new DVec3(0, 0, 1), new DVec3(0, 1, 0)],
    ['-vz', 'vy', new DVec3(0, 0, -1), new DVec3(0, 1, 0)],
    ['FdVector3d(0,0.6,0.8)', 'vx', new DVec3(0, 0.6, 0.8), new DVec3(1, 0, 0)],
  ])('selects top, positive width, bottom, negative width for normal %s', (normalCode, upCode, normal, up) => {
    const center = new DVec3(11, 23, 37);
    const right = cross(normal, up);
    const outward = [up, right, up.mul(-1), right.mul(-1)];
    for (let side = 0; side < 4; ++side) {
      const mesh = build(`
FdPoint3d p[2]={FdPoint3d(11,23,37),FdPoint3d(11,23,37)+(${normalCode})*70};
FdVector3d normals[2]={${normalCode},${normalCode}}, ups[2]={${upCode},${upCode}};
double widths[2]={40,40}, heights[2]={20,20};
bool sides[4]={${[0, 1, 2, 3].map((i) => i === side).join(',')}};
makeBox(1,p,normals,ups,widths,heights,sides,false,false,0,0,0);`);
      expect(mesh.indices).toHaveLength(6);
      for (const index of mesh.indices) {
        const v = mesh.vertices[index];
        expect(dot(new DVec3(v.x, v.y, v.z).sub(center), outward[side])).toBeCloseTo(side % 2 ? 20 : 10, 4);
      }
    }
  });

  it.each([
    ['makeBox(1,p,n,u,w,h,sides,false,false,0,0,0)', 20],
    ['makeBox(1,p,n,u,w,h,sides,edges,false,false,0,0,0)', 20],
    ['makeBoxFromPlanes(1,p,n,u,w,h,sides,false,false,0,0,0)', 20],
    ['makeBox(1,p,n,w,h,sides,conn)', -20],
    ['makeBox(1,p,n,w,h,sides,edges,conn)', -20],
    ['makeBox(1,p,w,h,sides,conn)', -20],
  ])('keeps the documented positive-width side across overloads: %s', (call, z) => {
    const mesh = build(`
FdPoint3d p[2]={FdPoint3d(),FdPoint3d(70,0,0)};
FdVector3d n[2]={vx,vx}, u[2]={vy,vy};
double w[2]={40,40}, h[2]={20,20};
bool sides[4]={false,true,false,false}, conn[2]={false,false};
bool edges[1][4]={{true,true,true,true}};
${call};`);
    expect(mesh.indices).toHaveLength(6);
    expect(mesh.indices.every((i) => mesh.vertices[i].z === z)).toBe(true);
  });

  it('keeps the outside wall of both sections in the Berliner cover', () => {
    const mesh = build(`
double r=45, d=1500, b=1000, a=600, alfa=45;
double alfaRadianOn=alfa*ARX_PI/180, gamma=0, min=1e9;
for(double i=1;i<alfa;i+=0.5) {
  double dis=fabs((r+d)/cos(i*ARX_PI/180)-(r+b)/cos((alfa-i)*ARX_PI/180));
  if(dis<min) { min=dis; gamma=i*ARX_PI/180; }
}
FdPoint3d centerRotatePoint(-0.5*d-r,0,0);
FdPoint3d points[3]={centerRotatePoint,centerRotatePoint,centerRotatePoint};
double maxLength=(r+d)/cos(gamma);
points[0].x+=r+d-0.5*r;
points[1].x+=(maxLength-0.5*r)*cos(gamma);
points[1].z+=(maxLength-0.5*r)*sin(gamma);
points[2].x+=r+b-0.5*r;
points[2].rotateBy(alfaRadianOn,-vy,centerRotatePoint);
FdVector3d nVs[3]={-vz,-vz,-vz};
nVs[1].rotateBy(gamma,-vy); nVs[2].rotateBy(alfaRadianOn,-vy);
FdVector3d uVs[3]={vy,vy,vy};
double tabHeights[3]={r,r,r}, tabWidths[3]={a,a,a};
bool sides[8]={true,true,true,false,true,true,true,false};
makeBox(2,points,nVs,uVs,tabHeights,tabWidths,sides,false,false,0,0,0);`);
    expect(mesh.vertices).toHaveLength(12);
    expect(mesh.indices).toHaveLength(36);
    const centers = [
      new DVec3(727.5, 0, 0),
      new DVec3(727.5034268589811, 0, 26.57539616925481),
      new DVec3(-71.98331623670208, 0, 723.0166837631918),
    ];
    for (let segment = 0; segment < 2; ++segment)
      for (const sign of [-1, 1]) {
        const wall = [segment, segment + 1].flatMap((i) => {
          const angle = ([0, 1, 45][i] * Math.PI) / 180;
          const p = centers[i].add(new DVec3(Math.cos(angle), 0, Math.sin(angle)).mul(sign * 22.5));

          return [p.add(new DVec3(0, 300, 0)), p.sub(new DVec3(0, 300, 0))];
        });
        let triangles = 0;
        for (let i = 0; i < mesh.indices.length; i += 3)
          if (
            mesh.indices.slice(i, i + 3).every((index) => {
              const v = mesh.vertices[index];

              return wall.some((p) => vectorLength(p.sub(new DVec3(v.x, v.y, v.z))) < 0.0001);
            })
          )
            ++triangles;
        expect(triangles).toBe(sign === 1 ? 2 : 0);
      }
  });
});

describe('rectangular connector flanges', () => {
  const bounds = (mesh: PreviewMesh) =>
    (['x', 'y', 'z'] as const).map((axis) => [
      Math.min(...mesh.vertices.map((v) => v[axis])),
      Math.max(...mesh.vertices.map((v) => v[axis])),
    ]);

  it('uses the same flat rim for the standalone makeConnector API', () => {
    const result = new GeometryRuntime().executeUpToLine('makeConnector(FdPoint3d(0,0,7), vz, vx, 100, 60, 10);', 999);
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    expect(bounds(scene.meshes[0])).toEqual([
      [-40, 40],
      [-60, 60],
      [7, 7],
    ]);
    expect(signedArea(scene.meshes[0], new DVec3(0, 0, 1))).toBe(120 * 80 - 100 * 60);
  });

  it.each([0, 35])('builds the nested boxes and base flange without extending their height (z=%s)', (z) => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      `double A = 300, B = 200, C = 160, H = 80;
FdPoint3d cP(0,0,${z});
FdPoint3d fullPoints[2] = { cP, cP };
fullPoints[1].z += H;
FdVector3d normalVectors[2] = { vz,vz };
FdVector3d upVectors[2] = { vx,vx };
double tabHeight[2] = { B , B };
double tabWidth[2] = { B, B };
bool sides[4] = { true, true, true, true };
makeBox(1, fullPoints, normalVectors, upVectors, tabHeight, tabWidth, sides, false, false, 0, 0, 0);
tabHeight[0] = tabHeight[1] = C;
tabWidth[0] = tabWidth[1] = C;
makeBox(1, fullPoints, normalVectors, upVectors, tabWidth, tabHeight, sides, false, false, 0, 0, (B - C) * 0.5);
fullPoints[1].z = fullPoints[0].z + 2;
makeBox(1, fullPoints, normalVectors, upVectors, tabWidth, tabHeight, sides, false, false, 0, 0, (A - C) * 0.5);
tabHeight[0] = tabHeight[1] = A;
tabWidth[0] = tabWidth[1] = A;
makeBox(1, fullPoints, normalVectors, upVectors, tabWidth, tabHeight, sides, false, false, 0, 0, 0);`,
      999,
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.apiCalls).toHaveLength(4);
    for (const [i, call] of result.apiCalls.entries()) {
      expect(call.signature?.parameters).toHaveLength(12);
      const size = [200, 160, 160, 300][i];
      // Each API call must retain its arrays before the next chained assignment.
      for (const index of [4, 5]) expect((call.arguments[index] as RuntimeArray).elements).toEqual([size, size]);
      expect((call.arguments[1] as RuntimeArray).elements).toMatchObject([{ z }, { z: z + (i < 2 ? 80 : 2) }]);
    }
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(8);
    expect(scene.meshes.filter((m) => m.apiName === 'makeBox').map(bounds)).toEqual([
      [
        [-100, 100],
        [-100, 100],
        [z, z + 80],
      ],
      [
        [-80, 80],
        [-80, 80],
        [z, z + 80],
      ],
      [
        [-80, 80],
        [-80, 80],
        [z, z + 2],
      ],
      [
        [-150, 150],
        [-150, 150],
        [z, z + 2],
      ],
    ]);
    const flanges = scene.meshes.filter((m) => m.apiName === 'makeBox.connector');
    expect(flanges.map(bounds)).toEqual([
      [
        [-100, 100],
        [-100, 100],
        [z, z],
      ],
      [
        [-100, 100],
        [-100, 100],
        [z + 80, z + 80],
      ],
      [
        [-150, 150],
        [-150, 150],
        [z, z],
      ],
      [
        [-150, 150],
        [-150, 150],
        [z + 2, z + 2],
      ],
    ]);
    expect(flanges.map((m) => signedArea(m, new DVec3(0, 0, 1)))).toEqual([
      -(200 ** 2 - 160 ** 2),
      200 ** 2 - 160 ** 2,
      -(300 ** 2 - 160 ** 2),
      300 ** 2 - 160 ** 2,
    ]);
  });

  it.each([
    [0, 4, 3600],
    [1, 1, 1100],
    [2, 1, 700],
    [3, 1, 1100],
    [4, 1, 700],
    [13, 2, 2200],
    [24, 2, 1400],
    [5, 0, 0],
    [7, 0, 0],
  ])('keeps side code %s in the section plane for the edges overload', (side, faces, area) => {
    const result = new GeometryRuntime().executeUpToLine(
      `FdPoint3d points[2] = { FdPoint3d(10,20,30), FdPoint3d(10,80,110) };
FdVector3d normals[2] = { FdVector3d(0,0.6,0.8), FdVector3d(0,0.6,0.8) };
FdVector3d ups[2] = { vx, vx };
double widths[2] = { 100, 100 }, heights[2] = { 60, 60 };
bool sides[4] = { true, true, true, true };
bool edges[1][4] = { { true, true, true, true } };
makeBox(1, points, normals, ups, widths, heights, sides, edges, false, false, ${side}, ${side}, 10);`,
      999,
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.apiCalls[0].signature?.parameters).toHaveLength(13);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    const flanges = scene.meshes.filter((m) => m.apiName.endsWith('.connector'));
    expect(flanges).toHaveLength(faces ? 2 : 0);
    const normal = new DVec3(0, 0.6, 0.8);
    for (const [i, mesh] of flanges.entries()) {
      expect(mesh.indices).toHaveLength(faces * 6);
      const center = i === 0 ? new DVec3(10, 20, 30) : new DVec3(10, 80, 110);
      for (const v of mesh.vertices) {
        expect(dot(new DVec3(v.x, v.y, v.z).sub(center), normal)).toBeCloseTo(0, 4);
      }
      expect(signedArea(mesh, normal)).toBeCloseTo(area * (i === 0 ? -1 : 1), 2);
    }
  });
});

describe('dashed centerlines', () => {
  const build = (source: string) => {
    const result = new GeometryRuntime().executeUpToLine(`setMeshColor(255,0,0);\n${source}`, 999);
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expectFiniteScene(scene);
    for (const mesh of scene.meshes) expect(mesh.color).toEqual({ r: 0, g: 1, b: 0 });

    return scene.meshes;
  };

  const segments = (mesh: PreviewMesh) => {
    const point = (i: number) => {
      const v = mesh.vertices[i];

      return new DVec3(v.x, v.y, v.z);
    };

    expect(mesh.primitive).toBe('lines');
    expect(mesh.indices.length % 2).toBe(0);

    return Array.from({ length: mesh.indices.length / 2 }, (_, i) => [
      point(mesh.indices[i * 2]),
      point(mesh.indices[i * 2 + 1]),
    ]);
  };

  it.each([10, 100])('draws gaps and retains both endpoints on a line of length %s', (length) => {
    const [mesh, solid] = build(`
addCenterLine(FdPoint3d(3,5,7),FdPoint3d(3,${5 + length},7));
makeSymbolicLine(FdPoint3d(3,5,7),FdPoint3d(3,${5 + length},7));`);
    const strokes = segments(mesh);
    expect(strokes.length).toBeGreaterThan(1);
    expect(strokes[0][0]).toEqual(new DVec3(3, 5, 7));
    expect(strokes.at(-1)![1]).toEqual(new DVec3(3, 5 + length, 7));
    for (let i = 1; i < strokes.length; ++i) expect(strokes[i][0].y - strokes[i - 1][1].y).toBeGreaterThan(0.1);
    expect(mesh.vertices.every((v) => v.x === 3 && v.z === 7)).toBe(true);
    expect(solid.primitive).toBeUndefined();
    expect(solid.indices).toHaveLength(12);
  });

  it('keeps the dash phase across short polyline segments, corners and repeated points', () => {
    const [line, polyline] = build(`
addCenterLine(FdPoint3d(),FdPoint3d(24,0,0));
FdPoint3d points[6]={FdPoint3d(),FdPoint3d(4,0,0),FdPoint3d(8,0,0),FdPoint3d(8,0,0),FdPoint3d(8,0,4),FdPoint3d(8,0,16)};
addCenterPolyLine(points,5);`);

    const ranges = (mesh: PreviewMesh) => {
      const result: number[][] = [];
      for (const [a, b] of segments(mesh)) {
        const from = a.x + a.z,
          to = b.x + b.z;
        const last = result.at(-1);
        if (last && Math.abs(last[1] - from) < 0.0001) last[1] = to;
        else result.push([from, to]);
      }

      return result;
    };

    const expected = ranges(line),
      actual = ranges(polyline);
    expect(actual).toHaveLength(expected.length);
    actual.forEach((range, i) => range.forEach((distance, j) => expect(distance).toBeCloseTo(expected[i][j], 4)));
    expect(segments(polyline).some(([a, b]) => Math.abs(a.x - 8) < 0.0001 && b.z > a.z)).toBe(true);
  });

  it.each(['ARX_PI/2', '-ARX_PI/2', '2*ARX_PI'])(
    'draws a dashed arc with gaps across its sampled segments (%s)',
    (angle) => {
      const [mesh] = build(`addCenterArc(FdPoint3d(),vz,vx,40,0,${angle});`);
      const strokes = segments(mesh);
      expect(strokes.length).toBeGreaterThan(2);
      expect(strokes.some(([a], i) => i > 0 && vectorLength(a.sub(strokes[i - 1][1])) > 1)).toBe(true);
      for (const stroke of strokes)
        for (const p of stroke) {
          expect(p.z).toBe(0);
          expect(Math.abs(vectorLength(p) - 40)).toBeLessThan(0.02);
        }
    },
  );

  it('skips zero-length paths and bounds the number of dashes on long lines', () => {
    const meshes = build(`
addCenterLine(FdPoint3d(),FdPoint3d());
FdPoint3d points[3]={FdPoint3d(),FdPoint3d(),FdPoint3d()};
addCenterPolyLine(points,2);
addCenterLine(FdPoint3d(),FdPoint3d(1e9,0,0));`);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].vertices.length).toBeLessThan(20000);
    expect(segments(meshes[0]).length).toBeGreaterThan(1);
  });
});

describe('symbol colors', () => {
  it.each([
    'makeSymbolicLine(FdPoint3d(), FdPoint3d(10,0,0));',
    'makeSymbolicCircle(FdPoint3d(), vz, 20);',
    'makeSymbolicArc(FdPoint3d(), vz, vx, 20, 90);',
    'makeRectHatch(FdPoint3d(), vz, vx, 10, 20);',
    'makeCircleSymbol(FdPoint3d(), vz, vx, 20, 5);',
    'makeAssemblyHole(FdPoint3d(), vz, vx, 20, 5);',
    'makeKFSymbolFlat(FdPoint3d(), vz, vx, 100, 50, 8, 5, 0, 5, 5);',
    'makeKFSymbolCurved(FdPoint3d(), vz, vx, 100, 20, 10, 20, 0, 5, 5);',
    'makeRectHoles(FdPoint3d(), vz, vx, 40, 80, 5, 4, 0, 0);',
    'addThinLine(FdPoint3d(), FdPoint3d(10,0,0));',
    'addCenterLine(FdPoint3d(), FdPoint3d(10,0,0));',
  ])('keeps %s green without changing the surrounding mesh colors', (symbol) => {
    const solid = 'makeFlatDisc(FdPoint3d(), vz, 20, 5);';
    const stages = [
      ['', { r: 1, g: Math.fround(176 / 255), b: 0 }],
      ['setMeshColor(255,0,0);', { r: 1, g: 0, b: 0 }],
      ['setPrimitiveMode(FLM3Geo::pmExtInsulation); setMeshColor(5);', { r: Math.fround(139 / 255), g: 0, b: 0 }],
      ['setPrimitiveMode(FLM3Geo::pmNormal);', { r: 0, g: 0, b: 1 }],
    ] as const;
    const source = stages.map(([setup]) => [setup, solid, symbol, solid].join('\n')).join('\n');
    const result = new GeometryRuntime().executeUpToLine(source, 999, true);
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes.filter((mesh) => mesh.apiName === 'makeFlatDisc').map((mesh) => mesh.color)).toEqual(
      stages.flatMap(([, color]) => [color, color]),
    );
    for (const [apiIndex, call] of result.apiCalls.entries()) {
      if (!symbol.startsWith(call.name + '(')) continue;
      const meshes = scene.meshes.filter((mesh) => mesh.apiIndex === apiIndex);
      expect(meshes.length).toBeGreaterThan(0);
      for (const mesh of meshes) {
        expect(mesh.indices.length).toBeGreaterThan(0);
        expect(mesh.color).toEqual({ r: 0, g: 1, b: 0 });
      }
    }
  });

  it('uses the native calls inside a user helper to decide the color', () => {
    const result = new GeometryRuntime().executeUpToLine(
      `void makeSymbolicLine() { makeFlatDisc(FdPoint3d(), vz, 20, 5); }
setMeshColor(255,0,0);
makeSymbolicLine();`,
      999,
      true,
    );
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0].color).toEqual({ r: 1, g: 0, b: 0 });
  });
});

it('keeps external insulation dark red across color changes and restores colors in normal mode', () => {
  const tube = 'makeVerySimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(0, 0, 100), 100, 8);';
  const source = [
    'setMeshColor(3);',
    tube,
    'setPrimitiveMode(FLM3Geo::pmExtInsulation);',
    tube,
    'setMeshColor(5);',
    tube,
    'setPrimitiveMode(FLM3Geo::pmNormal);',
    tube,
    'setPrimitiveMode(FLM3Geo::pmExtInsulation);',
    tube,
  ].join('\n');
  const runtime = new GeometryRuntime();
  const engine = new PreviewGeometryEngine();
  const result = runtime.executeUpToLine(source, 999);
  expect(result.diagnostics).toEqual([]);
  const scene = engine.build(result);
  expect(scene.warnings).toEqual([]);
  const darkRed = { r: Math.fround(139 / 255), g: 0, b: 0 };
  expect(scene.meshes.map((mesh) => mesh.color)).toEqual([
    { r: 0, g: 1, b: 0 },
    darkRed,
    darkRed,
    { r: 0, g: 0, b: 1 },
    darkRed,
  ]);
  // Rebuilding unrelated code must not retain the previous insulation mode.
  expect(engine.build(runtime.executeUpToLine('setMeshColor(3);\n' + tube, 999)).meshes[0].color).toEqual({
    r: 0,
    g: 1,
    b: 0,
  });
});

describe('API overload resolution', () => {
  it('resolves each call once, in the runtime, and geometry reuses it', () => {
    const source = [
      'FdPoint3d a(0, 0, 0);',
      'FdPoint3d b(0, 0, 10);',
      'makeVerySimpleTube(a, b, 2, 12);',
      'makeVerySimpleTube(b, a, 3);',
      'makeDisc(a, FdVector3d(0, 0, 1), 4, 1, 16, false);',
    ].join('\n');
    const lookups = vi.spyOn(apiMetadata, 'resolveApiSignature');
    try {
      const runtime = new GeometryRuntime();
      const result = runtime.executeUpToLine(source, 5, true);
      expect(result.apiCalls).toHaveLength(3);
      expect(lookups).toHaveBeenCalledTimes(3);
      expect(result.apiCalls.map((call) => call.signature?.name)).toEqual([
        'makeVerySimpleTube',
        'makeVerySimpleTube',
        'makeDisc',
      ]);

      const scene = new PreviewGeometryEngine().build(result);
      expect(scene.meshes.length).toBeGreaterThan(0);
      expect(lookups).toHaveBeenCalledTimes(3);
    } finally {
      lookups.mockRestore();
    }
  });
});

describe('preview adapter registry', () => {
  it('rejects an API name registered to two adapters', () => {
    const draw = () => true;

    const registered = new Set<string>();
    adapterMap([['makeTube', draw]], registered);
    expect(() => adapterMap([['makeTube', draw]], registered)).toThrow('preview adapter registered twice: makeTube');
  });

  it('draws make_line and make_thin_line with the planar adapter', () => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      'FdPoint3d a(0, 0, 0), b(100, 0, 0);\nmake_line(a, b);\nmake_thin_line(a, b);',
      999,
    );
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(2);
    expect(supportedPreviewApiNames().filter((name) => name === 'make_line')).toHaveLength(1);
  });

  it('has an adapter for every PnGeometry.h make_* API', () => {
    const supported = new Set(supportedPreviewApiNames());
    const planar = apiMetadata
      .allNativeApiSignatures()
      .filter((signature) => signature.sourceHeader === 'PnGeometry.h' && signature.name.startsWith('make_'))
      .map((signature) => signature.name);
    expect(planar.length).toBeGreaterThan(30);
    expect(planar.filter((name) => !supported.has(name))).toEqual([]);
  });

  it('keeps every API in no_adapter.cpp without an adapter, so that fixture still draws nothing', () => {
    const [fixture] = listFixtures('geometry').filter((item) => item.name === 'geometry/no_adapter.cpp');
    const result = new GeometryRuntime().executeUpToLine(fixture.code, 999);
    const supported = new Set(supportedPreviewApiNames());
    expect(result.apiCalls.map((call) => call.name).filter((name) => supported.has(name))).toEqual([]);
    expect(new PreviewGeometryEngine().build(result).meshes).toEqual([]);
  });
});

describe('vasco transitions', () => {
  it('shades the rectangle-to-round walls with outward normals across the loft', () => {
    const result = new GeometryRuntime().executeUpToLine(
      'FdPoint3d p(0,0,0); double diam[2] = {80,80}; double len[4] = {200,0,0,0};\n' +
        'makeVascoTransition(p, vx, vz, 120, 100, diam, 0, len, 4);',
      999,
    );
    const [mesh] = new PreviewGeometryEngine().build(result).meshes;
    expect(mesh.vertices.length).toBeGreaterThan(0);
    for (const v of mesh.vertices) {
      const normal = new DVec3(v.nx, v.ny, v.nz);
      const radial = new DVec3(0, v.y, v.z);
      // The loft runs along +x: a wall normal points away from that axis and mostly across it.
      expect(dot(normal, radial)).toBeGreaterThan(0);
      expect(Math.abs(normal.x)).toBeLessThan(0.5);
    }
  });
});

describe('tube-to-tube intersections', () => {
  const frame = 'FdPoint3d p(0,0,0); FdVector3d n(0,0,1), up(0,1,0);';

  const build = (code: string) => new PreviewGeometryEngine().build(new GeometryRuntime().executeUpToLine(code, 999));

  const distanceToMesh = (point: DVec3, mesh: PreviewMesh): number => {
    let nearest = Infinity;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = mesh.indices.slice(i, i + 3).map((index) => {
        const v = mesh.vertices[index];

        return new DVec3(v.x, v.y, v.z);
      });
      const normal = cross(points[1].sub(points[0]), points[2].sub(points[0]));
      const squared = dot(normal, normal);
      if (squared < 1e-16) continue;
      const signed = dot(point.sub(points[0]), normal);
      const projected = point.sub(normal.mul(signed / squared));
      const edges = points.map((a, j) => [a, points[(j + 1) % 3]]);
      if (edges.every(([a, b]) => dot(cross(b.sub(a), projected.sub(a)), normal) >= -1e-6 * squared))
        nearest = Math.min(nearest, Math.abs(signed) / Math.sqrt(squared));
      else
        for (const [a, b] of edges) {
          const edge = b.sub(a);
          const t = Math.max(0, Math.min(1, dot(point.sub(a), edge) / dot(edge, edge)));
          nearest = Math.min(nearest, vectorLength(point.sub(a.add(edge.mul(t)))));
        }
    }

    return nearest;
  };

  const expectJoined = (main: PreviewMesh, branch: PreviewMesh, origin: DVec3, axis: DVec3, n: number) => {
    const projected = new DVec3(1, 0, 0).sub(axis.mul(axis.x));
    const up = projected.mul(1 / vectorLength(projected)),
      side = cross(axis, up);
    for (let i = 0; i < 4 * n; ++i) {
      const angle = (i * 2 * Math.PI) / (4 * n);
      const radial = up.mul(12.5 * Math.cos(angle)).add(side.mul(12.5 * Math.sin(angle)));
      const lengths = branch.vertices.flatMap((v) => {
        const p = new DVec3(v.x, v.y, v.z).sub(origin);
        const along = dot(p, axis);

        return vectorLength(p.sub(axis.mul(along)).sub(radial)) < 0.0001 ? [along] : [];
      });
      expect(lengths.length).toBeGreaterThan(0);
      const seam = origin.add(radial).add(axis.mul(Math.min(...lengths)));
      expect(distanceToMesh(seam, main)).toBeLessThan(0.0001);
    }
    const edges = new Map<string, { a: DVec3; b: DVec3; count: number; direction: number }>();
    for (const mesh of [main, branch])
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const triangle = mesh.indices.slice(i, i + 3).map((index) => {
          const p = mesh.vertices[index];

          return new DVec3(p.x, p.y, p.z);
        });
        for (let j = 0; j < 3; ++j) {
          const a = triangle[j],
            b = triangle[(j + 1) % 3];
          const ka = `${a.x},${a.y},${a.z}`,
            kb = `${b.x},${b.y},${b.z}`;
          const key = [ka, kb].sort().join('|');
          const edge = edges.get(key) ?? { a, b, count: 0, direction: 0 };
          ++edge.count;
          edge.direction += ka < kb ? 1 : -1;
          edges.set(key, edge);
        }
      }
    const mainEnds = [Math.min(...main.vertices.map((p) => p.x)), Math.max(...main.vertices.map((p) => p.x))];
    const branchEnd = Math.max(...branch.vertices.map((p) => dot(new DVec3(p.x, p.y, p.z).sub(origin), axis)));
    const unmatched = [...edges.values()].filter(({ a, b, count, direction }) => {
      if (count === 2 && direction === 0) return false;
      if (count !== 1) return true;
      if (mainEnds.some((x) => Math.abs(a.x - x) < 0.0001 && Math.abs(b.x - x) < 0.0001)) return false;

      return (
        Math.abs(dot(a.sub(origin), axis) - branchEnd) > 0.0001 ||
        Math.abs(dot(b.sub(origin), axis) - branchEnd) > 0.0001
      );
    });
    expect(unmatched.length, 'edges at the junction must have two faces with opposite winding').toBe(0);
  };

  it('joins the DN40/DN25 Berliner asymmetric tee supplied by the user', () => {
    const scene = build(`
void BerlinerBlockCreator::makeAsymmetric_Cicular_Tee() {
 double L1=60, L3=30, d1=40, d2=25, d3=25;
 get_val("D2",d1); get_val("D1",d2); get_val("D3",d3); get_val("L1",L1); get_val("L3",L3);
 FdPoint3d cP, sP=cP;
 sP.x-=L1/2;
 double tubeData[]={d1,L1*4/5}, innerDiam[]={d3,L3,L1*0.4,0}, angle[]={0,0};
 makeTubeToTubeIntersection2(sP,vx,tubeData,innerDiam,angle,cpx,false);
 sP.x+=L1*4/5;
 FdPoint3d eP=sP; eP.x+=L1/5;
 makeSimpleTube(sP,eP,d1,d2,cpx);
 FdPoint3d points[2]={cP,cP}; points[0].x-=0.5*L1; points[1].x+=0.5*L1;
 addCenterLine(points[0],points[1]);
 points[0].x+=L1*0.4; points[1]=points[0]; points[1].z+=L3;
 addCenterLine(points[0],points[1]);
}`);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(5);
    expectJoined(scene.meshes[0], scene.meshes[1], new DVec3(-6, 0, 0), new DVec3(0, 0, 1), 10);
    expect(distanceToMesh(new DVec3(-6, 0, 20), scene.meshes[0])).toBeGreaterThan(10);
  });

  it('opens the main tube even when a small branch crosses only the interior of a face', () => {
    const scene = build(`
double tube[]={40,120}, branch[]={1,30,60,0}, angles[]={0,0};
makeTubeToTubeIntersection2(FdPoint3d(-60,0,0),vx,tube,branch,angles,2,false);`);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(2);
    expect(distanceToMesh(new DVec3(0, 0, 20), scene.meshes[0])).toBeGreaterThan(0.4);
  });

  it.each([
    [2, 1, 1, 0, 0, 40],
    [1, 2, 3, 0, 0, 40],
    [2, 2, 2, 0, 0, 40],
    [1, 10, 4, 0, 5, 50],
    [2, 10, 10, 0, 5, 40],
    [1, 4, 7, 45, 5, 50],
    [2, 7, 7, 45, 5, 40],
    [2, 64, 64, 0, 0, 40],
  ])('joins API %s at resolutions %s/%s, angle %s, offset %s, diameter %s', (api, n, bn, tilt, offset, diameter) => {
    const scene = build(
      api === 1
        ? `
double tube[]={40,${diameter},120}, position[]={60,${offset}}, branch[]={80,25,25};
double angles[]={${90 + tilt},90,0}; int n[]={${n},${bn}}; bool options[]={false,false};
makeTubeToTubeIntersection(FdPoint3d(-60,0,0),vx,vy,tube,position,branch,angles,n,options);`
        : `
double tube[]={40,120}, branch[]={25,80,60,${offset}}, angles[]={${tilt},0};
makeTubeToTubeIntersection2(FdPoint3d(-60,0,0),vx,tube,branch,angles,${n},false);`,
    );
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(2);
    const angle = (tilt * Math.PI) / 180,
      sign = api === 1 ? 1 : -1;
    expectJoined(
      scene.meshes[0],
      scene.meshes[1],
      new DVec3(0, sign * offset, 0),
      new DVec3(sign * Math.sin(angle), 0, Math.cos(angle)),
      bn,
    );
  });

  it.each([
    [
      'a short position array',
      'double pos[1] = {100}; double ang[3] = {90,0,0};',
      'makeTubeToTubeIntersection: interTubePosition needs 2 numbers',
    ],
    [
      'a scalar angle',
      'double pos[2] = {100,0}; double ang = 90;',
      'makeTubeToTubeIntersection: angles must be a number array',
    ],
  ])('warns instead of drawing nothing for %s', (_, declarations, warning) => {
    const scene = build(
      `${frame} double tube[3] = {100,100,300}; double inter[3] = {200,50,50}; int cx[2] = {8,8};` +
        ` bool opt[2] = {false,false}; ${declarations}` +
        ' makeTubeToTubeIntersection(p, n, up, tube, pos, inter, ang, cx, opt);',
    );
    expect(scene.meshes).toEqual([]);
    expect(scene.warnings).toEqual([`line 1 ${warning}`]);
  });

  it('warns when makeTubeToTubeIntersection2 gets a short branch array', () => {
    const scene = build(
      `${frame} double td[2] = {100,300}; double it[2] = {50,200}; double an[2] = {90,0};` +
        ' makeTubeToTubeIntersection2(p, n, up, td, it, an, 8, false);',
    );
    expect(scene.warnings).toEqual(['line 1 makeTubeToTubeIntersection2: interTubeData needs 4 numbers']);
  });

  it.each([
    ['bool opt[1] = {true};', 'options needs 2 booleans'],
    ['bool opt = true;', 'options must be a bool array'],
  ])('warns for invalid intersection options: %s', (declaration, warning) => {
    const scene = build(
      `${frame} double tube[3] = {100,100,300}; double inter[3] = {200,50,50}; int cx[2] = {8,8};` +
        ` double pos[2] = {100,0}; double ang[3] = {90,0,0}; ${declaration}` +
        ' makeTubeToTubeIntersection(p, n, up, tube, pos, inter, ang, cx, opt);',
    );
    expect(scene.meshes).toEqual([]);
    expect(scene.warnings).toEqual([`line 1 makeTubeToTubeIntersection: ${warning}`]);
  });

  it.each([
    [false, 0],
    [false, 90],
    [false, 180],
    [false, 270],
    [true, 0],
    [true, 90],
    [true, 180],
    [true, 270],
  ] as const)(
    'makeTubeToTubeIntersection2 halves only the main tube (upVector=%s, rotation=%s)',
    (explicitUp, rotation) => {
      const scenes = [false, true].map((half) => {
        const result = new GeometryRuntime().executeUpToLine(
          `
FdPoint3d start(7,11,13);
double tube[2]={80,200}, branch[4]={20,100,100,0}, angles[2]={30,${rotation}};
makeTubeToTubeIntersection2(start,vx,${explicitUp ? 'vz,' : ''}tube,branch,angles,4,${half});`,
          999,
        );
        expect(result.diagnostics).toEqual([]);
        const scene = new PreviewGeometryEngine().build(result);
        expect(scene.warnings).toEqual([]);
        expect(scene.meshes.map((mesh) => mesh.apiName)).toEqual([
          'makeTubeToTubeIntersection2.main',
          'makeTubeToTubeIntersection2.branch',
        ]);
        expectFiniteScene(scene);

        return scene;
      });
      const [full, half] = scenes;
      const angle = (rotation * Math.PI) / 180;

      const facing = (v: { y: number; z: number }) => -(v.y - 11) * Math.sin(angle) + (v.z - 13) * Math.cos(angle);

      expect(full.meshes[0].vertices.some((v) => facing(v) < -1)).toBe(true);
      expect(half.meshes[0].vertices.every((v) => facing(v) >= -0.0001)).toBe(true);
      expect(half.meshes[0].vertices.some((v) => facing(v) > 1)).toBe(true);
      expect(half.meshes[1].vertices).toEqual(full.meshes[1].vertices);
      expect(half.meshes[1].indices).toEqual(full.meshes[1].indices);
    },
  );

  it('still accepts an angle array that only sets the first angle', () => {
    const scene = build(
      `${frame} double tube[3] = {100,100,300}; double inter[3] = {200,50,50}; int cx[2] = {8,8};` +
        ' bool opt[2] = {false,false}; double pos[2] = {100,0}; double ang[1] = {90};' +
        ' makeTubeToTubeIntersection(p, n, up, tube, pos, inter, ang, cx, opt);',
    );
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(2);
    expectFiniteScene(scene);
  });
});

describe('Berliner elbow and tee regressions', () => {
  const build = (source: string) => {
    const result = new GeometryRuntime().executeUpToLine(source, 999);
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expectFiniteScene(scene);

    return scene;
  };

  const point = (v: { x: number; y: number; z: number }) => new DVec3(v.x, v.y, v.z);

  const average = (vertices: { x: number; y: number; z: number }[]) =>
    vertices.reduce<DVec3>((sum, v) => sum.add(point(v)), new DVec3()).mul(1 / vertices.length);

  const near = (actual: DVec3, expected: DVec3) => expect(vectorLength(actual.sub(expected))).toBeLessThan(0.0001);

  const containsPoint = (mesh: PreviewMesh, expected: DVec3) =>
    expect(Math.min(...mesh.vertices.map((v) => vectorLength(point(v).sub(expected))))).toBeLessThan(0.0001);

  it.each([30, 45, 90])('joins the Berliner symmetric bend to both connectors (angle=%s)', (angle) => {
    const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeSymetricBend(FdPoint3d(11,23,37),-vz,-vy,sides,false,${angle},80,100,120,70,12,40,80,false);`).meshes;
    const center = new DVec3(11, 23, 37);
    const theta = (angle * Math.PI) / 180;
    const radial = new DVec3(Math.cos(theta), 0, Math.sin(theta));
    const exit = center.add(new DVec3(-80, 0, 0)).add(radial.mul(100));
    for (const sign of [-1, 1])
      for (const upper of [-1, 1]) {
        containsPoint(mesh, center.add(new DVec3(sign * 40, upper * 50, -70)));
        containsPoint(mesh, exit.add(radial.mul(sign * 60)).add(new DVec3(0, upper * 50, 0)));
      }
    containsPoint(mesh, center.add(new DVec3(-40, -50, 0)));
    expect(mesh.vertices.some((v) => v.z > center.z)).toBe(true);
    expect(boundaryLoops(mesh)).toBe(2);
  });

  it.each([
    [1500, 1000, 45, 45, 45, 731.360389693, -22.14682732],
    [1000, 1500, 45, 45, 45, 518.639610309, 1094.959953867],
    [80, 120, 40, 60, 30, 56.076951546, 52.153903092],
    [120, 80, 40, 60, 30, 43.923048454, 22.871870789],
    [80, 120, 40, 60, 90, -20, 100],
    [80, 120, 40, 60, 120, -20, 150.111069989],
  ])(
    'matches the SDK tangent bisector for widths %s/%s and radii %s/%s at %s degrees',
    (beginWidth, endWidth, r1, r2, angle, outerX, outerZ) => {
      const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeSymetricBend(FdPoint3d(),-vz,-vy,sides,false,${angle},${beginWidth},100,${endWidth},500,8,${r1},${r2},0,false);`).meshes;
      // Centers obtained from the supplied SDK's I -> IE/IB -> W construction.
      for (let i = 0; i <= 8; ++i) {
        const theta = (((angle * Math.PI) / 180) * i) / 8;
        containsPoint(mesh, new DVec3(outerX + r2 * Math.cos(theta), -50, outerZ + r2 * Math.sin(theta)));
      }
    },
  );

  it.each([
    [1500, 1000, 45, false, 500],
    [1500, 1000, 45, true, -500],
    [1000, 1200, 45, false, 500],
    [1500, 1000, 30, false, 1000],
    [1500, 1000, 90, false, 500],
  ])(
    'covers the bend using explicit insulation radii for widths %s/%s, angle=%s, reverse=%s, lead=%s',
    (beginWidth, endWidth, angle, reverse, lead) => {
      const source = `
double d=${beginWidth}, a=600, b=${endWidth}, alfa=${angle}, r=60, size;
bool side[4]={true,true,true,true};
FdPoint3d cP(11,23,37);
makeSymetricBend(cP,-vz,-vy,side,${reverse},alfa,d,a,b,${lead},10,r,false,false);
if (getExtInsSize(size)) {
  setMeshColor(1);
  setPrimitiveMode(FLM3Geo::pmExtInsulation);
  makeSymetricBend(cP,-vz,-vy,side,${reverse},alfa,d+2*size,a+2*size,b+2*size,${lead},10,r-size,r+size,false,false);
}`;
      const runtime = new GeometryRuntime();
      runtime.setParameters(new Map([['getExtInsSize', '20']]));
      const result = runtime.executeUpToLine(source, 999);
      const scene = new PreviewGeometryEngine().build(result);
      expect(result.diagnostics).toEqual([]);
      expect(scene.warnings).toEqual([]);
      expect(scene.meshes).toHaveLength(2);
      expectFiniteScene(scene);
      const [body, insulation] = scene.meshes;

      const triangles = (mesh: PreviewMesh) =>
        Array.from({ length: mesh.indices.length / 3 }, (_, i) =>
          mesh.indices.slice(3 * i, 3 * i + 3).map((index) => point(mesh.vertices[index])),
        );

      const covering = triangles(insulation).filter((t) => t.every((v) => v.y === 23 - 320));

      const inside = (p: DVec3, [a, b, c]: DVec3[]) => {
        const edge = (u: DVec3, v: DVec3, q: DVec3) => (v.x - u.x) * (q.z - u.z) - (v.z - u.z) * (q.x - u.x);

        const area = edge(a, b, c);
        const weights = [edge(a, b, p) / area, edge(b, c, p) / area, edge(c, a, p) / area];

        return weights.every((w) => w >= -1e-6 && w <= 1 + 1e-6);
      };

      for (const t of triangles(body)) {
        const samples = [...t, ...t.map((p, i) => p.add(t[(i + 1) % 3]).mul(0.5)), average(t)];
        for (const p of samples)
          expect(
            covering.some((triangle) => inside(p, triangle)),
            JSON.stringify(p),
          ).toBe(true);
      }
    },
  );

  it('connects corresponding inner and outer samples as SDK polygon-mesh strips', () => {
    const [mesh] = build(`
bool sides[4]={true,false,false,false};
makeSymetricBend(FdPoint3d(),-vz,-vy,sides,false,90,80,100,120,30,2,40,60,0,false);`).meshes;
    const samples = [
      [-40, -30, 40, -30],
      [-40, 0, 40, 100],
      [-80 + 40 * Math.SQRT1_2, 40 * Math.SQRT1_2, -20 + 60 * Math.SQRT1_2, 100 + 60 * Math.SQRT1_2],
      [-80, 40, -20, 160],
      [-80, 40, -80, 160],
    ].map(([ix, iz, ox, oz]) => [new DVec3(ix, -50, iz), new DVec3(ox, -50, oz)]);
    expect(mesh.indices).toHaveLength(21);
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const triangle = mesh.indices.slice(i, i + 3).map((index) => point(mesh.vertices[index]));
      expect(
        samples.slice(1).some((section, j) => {
          const corners = [...samples[j], ...section];

          return triangle.every((p) => corners.some((q) => vectorLength(p.sub(q)) < 0.0001));
        }),
      ).toBe(true);
    }
    expect(triangleAreas(mesh, new DVec3(0, -1, 0)).every((area) => area > 0)).toBe(true);
  });

  it('keeps the SDK mesh unchanged by its unused endBox and endCon arguments', () => {
    const source = (radii: string, endBox: number, endCon: boolean) => `
bool sides[4]={true,true,true,true};
makeSymetricBend(FdPoint3d(),-vz,-vy,sides,false,90,80,100,120,30,8,${radii},${endBox},${endCon});`;

    const baseline = build(source('40', 0, false));
    for (const radii of ['40', '40,40']) {
      const scene = build(source(radii, 80, true));
      expect(scene.meshes).toHaveLength(1);
      expect(scene.meshes[0].vertices).toEqual(baseline.meshes[0].vertices);
      expect(scene.meshes[0].indices).toEqual(baseline.meshes[0].indices);
    }
  });

  it.each([0, -45])('returns without geometry when alfa=%s, as in the SDK', (angle) => {
    const scene = build(`
bool sides[4]={true,true,true,true};
makeSymetricBend(FdPoint3d(),-vz,-vy,sides,false,${angle},80,100,120,30,8,40,0,false);`);
    expect(scene.meshes).toEqual([]);
  });

  it.each([false, true])('uses the supplied frame and signed lead for reverse=%s', (reverse) => {
    const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeSymetricBend(FdPoint3d(11,23,37),FdVector3d(0,3,4),FdVector3d(2,0,0),sides,${reverse},90,80,100,120,30,8,40,60,0,false);`).meshes;
    const center = new DVec3(11, 23, 37),
      up = new DVec3(1, 0, 0);
    const normal = new DVec3(0, 0.6, 0.8),
      right = new DVec3(0, 0.8, -0.6);
    const travel = normal.mul(reverse ? 1 : -1);
    for (const sign of [-1, 1]) {
      containsPoint(
        mesh,
        center
          .add(right.mul(sign * 40))
          .add(normal.mul(30))
          .add(up.mul(50)),
      );
      containsPoint(
        mesh,
        center
          .add(right.mul(80))
          .add(travel.mul(100 + sign * 60))
          .add(up.mul(50)),
      );
    }
  });

  it('copies the inner radius to the shifted outer curve in the one-radius overload', () => {
    const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeSymetricBend(FdPoint3d(),-vz,-vy,sides,false,90,80,100,120,0,8,40,0,false);`).meshes;
    const diagonal = 40 * Math.SQRT1_2;
    containsPoint(mesh, new DVec3(-80 + diagonal, -50, diagonal));
    containsPoint(mesh, new DVec3(diagonal, -50, 120 + diagonal));
    containsPoint(mesh, new DVec3(40, -50, 120));
    containsPoint(mesh, new DVec3(0, -50, 160));
  });

  it('uses the two symmetric-bend radii for inner and outer curves without shifting insulation connectors', () => {
    const meshes = build(`
bool sides[4]={true,true,true,true};
makeSymetricBend(FdPoint3d(),-vz,-vy,sides,false,90,80,100,120,30,8,40,0,false);
makeSymetricBend(FdPoint3d(),-vz,-vy,sides,false,90,90,110,130,30,8,35,45,0,false);`).meshes;
    for (let i = 0; i < meshes.length; ++i) {
      const halfWidth = 40 + i * 5,
        halfEnd = 60 + i * 5,
        halfHeight = 50 + i * 5;
      for (const sign of [-1, 1]) {
        containsPoint(meshes[i], new DVec3(sign * halfWidth, -halfHeight, -30));
        containsPoint(meshes[i], new DVec3(-80, -halfHeight, 100 + sign * halfEnd));
      }
    }
    containsPoint(meshes[1], new DVec3(-80 + 35 * Math.SQRT1_2, -55, 35 * Math.SQRT1_2));
    containsPoint(meshes[1], new DVec3(45 * Math.SQRT1_2, -55, 120 + 45 * Math.SQRT1_2));
  });

  it.each([0, 40])('keeps the outside of RectBend square and the inside curved (radius=%s)', (radius) => {
    const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeRectBend(FdPoint3d(),-vz,-vy,sides,false,80,100,120,7,${radius});`).meshes;
    const top = mesh.vertices.filter((v) => v.y === -50);
    containsPoint(mesh, new DVec3(40, -50, radius + 120));
    containsPoint(mesh, new DVec3(-40 - radius, -50, radius + 120));
    containsPoint(mesh, new DVec3(-40 - radius, -50, radius));
    expect(top.filter((v) => Math.abs(v.x - 40) < 0.0001 || Math.abs(v.z - radius - 120) < 0.0001)).toHaveLength(3);
    expect(top).toHaveLength(radius === 0 ? 4 : 11);
    expect(boundaryLoops(mesh)).toBe(radius === 0 ? 1 : 2);
  });

  it.each(['makeRectBend', 'makeSymetricBend'])(
    'reflects %s at its inlet while preserving signed beginLength',
    (api) => {
      const source = (reverse: boolean, lead: number) => `
bool sides[4]={true,true,true,true};
${api}(FdPoint3d(11,23,37),-vz,-vy,sides,${reverse},${api === 'makeRectBend' ? '80,100,120,8,40,true' : `70,80,100,120,${lead},8,40,50,25,true`});`;

      const original = build(source(false, 30)),
        reversed = build(source(true, -30));
      expect(reversed.meshes).toHaveLength(api === 'makeRectBend' ? 2 : 1);
      original.meshes.forEach((mesh, i) => {
        expect(reversed.meshes[i].vertices).toHaveLength(mesh.vertices.length);
        for (const v of mesh.vertices) containsPoint(reversed.meshes[i], new DVec3(v.x, v.y, 74 - v.z));
      });
    },
  );

  it.each(['makeRectBend', 'makeSymetricBend'])('honors each of the four %s side flags', (api) => {
    const source = (flags: string) => `
bool sides[4]={${flags}};
${api}(FdPoint3d(),-vz,-vy,sides,false,${api === 'makeRectBend' ? '80,100,120,8,40,false' : '90,80,100,120,30,8,40,25,false'});`;

    const [full] = build(source('true,true,true,true')).meshes;
    let count = 0;
    for (let side = 0; side < 4; ++side) {
      const [mesh] = build(source(Array.from({ length: 4 }, (_, i) => String(i === side)).join(','))).meshes;
      expect(mesh.indices.length).toBeGreaterThan(0);
      count += mesh.indices.length;
      if (side === 0 || side === 2) {
        const normal = new DVec3(0, side === 0 ? -1 : 1, 0);
        expect(triangleAreas(mesh, normal).every((area) => area > 0)).toBe(true);
        expect(mesh.indices.every((index) => mesh.vertices[index].y === normal.y * 50)).toBe(true);
      }
    }
    expect(count).toBe(full.indices.length);
  });

  it.each([45, 90])('joins makeSymmetricElbow sections at W=%s', (angle) => {
    const scene = build(`
double a=100, b=80, e=100, f=120, w=${angle};
bool sides[4]={true,true,true,true};
FdPoint3d p[2]={FdPoint3d(),FdPoint3d(0,0,e)};
FdVector3d normals[2]={vz,vz}, ups[2]={vx,vx};
double widths[2]={a,a}, heights[2]={b,b};
makeBox(1,p,normals,ups,widths,heights,sides,false,false,0,0,0);
makeBend2(p[1],-vz,-vy,sides,false,w,w,b,a,b,20,0,0);
p[0].x-=b/2; p[0].z+=b/2+e;
p[1]=p[0]; p[1].x-=f;
FdPoint3d center=p[0]; center.z-=b/2;
p[0].rotateBy(ARX_PI/2-ARX_PI*w/180,vy,center);
p[1].rotateBy(ARX_PI/2-ARX_PI*w/180,vy,center);
normals[0].rotateBy(ARX_PI/2-ARX_PI*w/180,vy);
normals[1]=normals[0];
ups[0].rotateBy(ARX_PI/2-ARX_PI*w/180,vy); ups[1]=ups[0];
makeBox(1,p,ups,normals,widths,heights,sides,false,false,0,0,0);`);
    expect(scene.meshes).toHaveLength(3);
    const [entry, bend, exit] = scene.meshes;

    const matches = (a: PreviewMesh['vertices'], b: PreviewMesh['vertices']) => {
      for (const v of a) expect(Math.min(...b.map((w) => vectorLength(point(v).sub(point(w)))))).toBeLessThan(0.0001);
    };

    matches(bend.vertices.slice(0, 4), entry.vertices.slice(-4));
    matches(bend.vertices.slice(-4), exit.vertices.slice(0, 4));
    const theta = (angle * Math.PI) / 180;
    near(average(bend.vertices.slice(-4)), new DVec3(-40 * (1 - Math.cos(theta)), 0, 100 + 40 * Math.sin(theta)));
  });

  it.each([false, true])('keeps R11 across the inlet and R12 along the inlet normal (reverse=%s)', (reverse) => {
    const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeBend2(FdPoint3d(),-vz,-vy,sides,${reverse},90,90,80,100,120,8,30,70);`).meshes;
    near(average(mesh.vertices.slice(0, 4)), new DVec3());
    near(average(mesh.vertices.slice(-4)), new DVec3(-70, 0, reverse ? -130 : 130));
    expect(
      mesh.vertices
        .slice(-4)
        .map((v) => v.z)
        .sort((a, b) => a - b),
    ).toEqual(reverse ? [-190, -190, -70, -70] : [70, 70, 190, 190]);
    expect(
      mesh.vertices
        .slice(-4)
        .map((v) => v.y)
        .sort((a, b) => a - b),
    ).toEqual([-50, -50, 50, 50]);
  });

  it.each([
    [new DVec3(0, 0, -1), new DVec3(0, -2, 0)],
    [new DVec3(1, 0, 0), new DVec3(0, 0, 3)],
    [new DVec3(1, 2, 3), new DVec3(2, -1, 0)],
    [new DVec3(1, 2, 3), new DVec3(1, -2, 4)],
  ])('reverses Bend2 across its inlet plane without moving the inlet (%j, %j)', (normal, up) => {
    const center = new DVec3(11, -23, 37);
    const axis = normal.mul(1 / vectorLength(normal));

    const reflect = (v: DVec3) => v.sub(axis.mul(2 * dot(axis, v)));

    for (const tail of ['30,70', '30,true,false']) {
      const source = (reverse: boolean) => `
bool sides[4]={true,false,true,true};
makeBend2(FdPoint3d(11,-23,37),FdVector3d(${normal.x},${normal.y},${normal.z}),FdVector3d(${up.x},${up.y},${up.z}),
          sides,${reverse},60,110,80,100,120,8,${tail});`;

      const [original] = build(source(false)).meshes;
      const [reversed] = build(source(true)).meshes;
      for (let i = 0; i < original.indices.length; i += 3)
        expect(reversed.indices.slice(i, i + 3)).toEqual([
          original.indices[i],
          original.indices[i + 2],
          original.indices[i + 1],
        ]);
      expect(reversed.vertices).toHaveLength(original.vertices.length);
      original.vertices.forEach((v, i) => {
        const actual = reversed.vertices[i];
        near(point(actual), center.add(reflect(point(v).sub(center))));
        near(new DVec3(actual.nx, actual.ny, actual.nz), reflect(new DVec3(v.nx, v.ny, v.nz)));
      });
      near(average(reversed.vertices.slice(0, 4)), center);
    }
  });

  it.each([58, 80])('joins all four MAGNA3 clamp bends and their end faces (B5=%s)', (b5) => {
    const { meshes } = build(`
double B3=185, B5=${b5};
bool sides[4]={true,true,true,true};
FdPoint3d bendPoint(0.15*B3,-0.475*2*B5,0);
makeBend2(bendPoint,vz,vx,sides,false,90,90,0.05*2*B5,0.09*B3,0.05*2*B5,cpx,0.45*2*B5,0.45*2*B5);
makeBend2(bendPoint,-vz,-vx,sides,false,90,90,0.05*2*B5,0.09*B3,0.05*2*B5,cpx,0.45*2*B5,0.45*2*B5);
bendPoint.z+=0.475*2*B5; bendPoint.y+=0.475*2*B5;
makeBend2(bendPoint,-vy,-vx,sides,false,88,88,0.05*2*B5,0.09*B3,0.05*2*B5,cpx,0.45*2*B5,0.45*2*B5);
bendPoint.z-=0.95*2*B5;
makeBend2(bendPoint,vy,-vx,sides,true,88,88,0.05*2*B5,0.09*B3,0.05*2*B5,cpx,0.45*2*B5,0.45*2*B5);
FdPoint3d centerRotatePoint(0.15*B3,0,0);
bendPoint.rotateBy(ARX_PI/180*88,vx,centerRotatePoint);
FdVector3d normalV=vy, upV=vz;
normalV.rotateBy(ARX_PI/180*88,vx);
upV.rotateBy(ARX_PI/180*88,vx);
makeRectFace(bendPoint,normalV,upV,0.05*2*B5,0.09*B3);
bendPoint.rotateBy(ARX_PI/180*4,vx,centerRotatePoint);
normalV.rotateBy(ARX_PI/180*4,vx);
upV.rotateBy(ARX_PI/180*4,vx);
makeRectFace(bendPoint,normalV,upV,0.05*2*B5,0.09*B3);`);
    expect(meshes).toHaveLength(6);
    const [bottomLeft, topLeft, topRight, bottomRight, bottomCap, topCap] = meshes;
    for (const [a, b] of [
      [bottomLeft.vertices.slice(0, 4), topLeft.vertices.slice(0, 4)],
      [bottomLeft.vertices.slice(-4), bottomRight.vertices.slice(0, 4)],
      [topLeft.vertices.slice(-4), topRight.vertices.slice(0, 4)],
      [bottomRight.vertices.slice(-4), bottomCap.vertices],
      [topRight.vertices.slice(-4), topCap.vertices],
    ])
      for (const v of a) expect(Math.min(...b.map((w) => vectorLength(point(v).sub(point(w)))))).toBeLessThan(0.0001);
    for (const mesh of meshes.slice(0, 4))
      for (const v of mesh.vertices) {
        expect(Math.hypot(v.y, v.z)).toBeGreaterThanOrEqual(0.9 * b5 - 0.0001);
        expect(Math.hypot(v.y, v.z)).toBeLessThanOrEqual(b5 + 0.0001);
      }
  });

  it('uses beta for the outer ellipse while preserving the inner endpoint', () => {
    const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeBend2(FdPoint3d(),-vz,-vy,sides,false,90,45,80,100,80,8,40,40);`).meshes;
    const [outerTop, innerTop, innerBottom, outerBottom] = mesh.vertices.slice(-4);
    near(average([innerTop, innerBottom]), new DVec3(-80, 0, 40));
    near(average([outerTop, outerBottom]), new DVec3(-80 + 120 / Math.sqrt(2), 0, 120 / Math.sqrt(2)));
  });

  it('ends both unequal ellipses on the requested radial angle', () => {
    const [mesh] = build(`
bool sides[4]={true,true,true,true};
makeBend2(FdPoint3d(),-vz,-vy,sides,false,45,45,80,100,120,8,30,70);`).meshes;
    const [outerTop, innerTop, innerBottom, outerBottom] = mesh.vertices.slice(-4);
    for (const [vertices, a, b] of [
      [[innerTop, innerBottom], 30, 70],
      [[outerTop, outerBottom], 110, 190],
    ] as const) {
      const p = average([...vertices]);
      expect(p.x + 70).toBeCloseTo(p.z, 4);
      expect(((p.x + 70) / a) ** 2 + (p.z / b) ** 2).toBeCloseTo(1, 5);
    }
  });

  it.each([1, -1])('draws addCenterArc using radians (direction=%s)', (sign) => {
    const [mesh] = build(`addCenterArc(FdPoint3d(-40,0,100),-vy,vx,40,0,${sign}*ARX_PI/2);`).meshes;
    near(point(mesh.vertices[0]), new DVec3(0, 0, 100));
    near(point(mesh.vertices.at(-1)!), new DVec3(-40, 0, 100 + sign * 40));
  });

  const tee = (angles = '135,90,0', options = 'false,false', frame = 'vx,vy', offset = 10) =>
    build(`
double tube[3]={80,40,200}, position[2]={100,${offset}}, branch[3]={100,20,30};
double angles[3]={${angles}}; int complexity[2]={4,4}; bool options[]={${options}};
makeTubeToTubeIntersection(FdPoint3d(),${frame},tube,position,branch,angles,complexity,options);`);

  const tipCenter = (mesh: PreviewMesh, origin: DVec3, direction: DVec3, length: number) => {
    const tip = mesh.vertices.filter((v) => Math.abs(dot(point(v).sub(origin), direction) - length) < 0.0001);
    const unique = new Map(tip.map((v) => [[v.x, v.y, v.z].map((c) => c.toFixed(4)).join(','), v]));
    expect(unique.size).toBeGreaterThan(4);

    return new DVec3(
      ...((['x', 'y', 'z'] as const).map((key) => {
        const values = [...unique.values()].map((v) => v[key]);

        return (Math.min(...values) + Math.max(...values)) / 2;
      }) as [number, number, number]),
    );
  };

  it.each([30, 90, 120])('applies the second branch angle (%s degrees)', (angle) => {
    const scene = tee(`135,${angle},0`);
    const direction = new DVec3(
      Math.SQRT1_2,
      Math.SQRT1_2 * Math.cos((angle * Math.PI) / 180),
      Math.SQRT1_2 * Math.sin((angle * Math.PI) / 180),
    );
    const origin = new DVec3(100, 10, 0);
    near(tipCenter(scene.meshes[1], origin, direction, 100), origin.add(direction.mul(100)));
  });

  it('rotates both tubes and the offset with the third angle', () => {
    const base = tee('123,67,0'),
      rotated = tee('123,67,37');
    const angle = (37 * Math.PI) / 180;
    for (let i = 0; i < 2; ++i) {
      expect(rotated.meshes[i].indices).toEqual(base.meshes[i].indices);
      base.meshes[i].vertices.forEach((v, j) =>
        near(
          point(rotated.meshes[i].vertices[j]),
          new DVec3(v.x, v.y * Math.cos(angle) - v.z * Math.sin(angle), v.y * Math.sin(angle) + v.z * Math.cos(angle)),
        ),
      );
    }
  });

  it.each([
    ['vx', 0],
    ['vx', 37],
    ['vx', 180],
    ['vx,vy', 0],
    ['vx,vy', 37],
    ['vx,vy', 180],
  ] as const)('hides each main tube half when its option is true (frame=%s, rotation=%s)', (frame, rotation) => {
    const angles = `123,67,${rotation}`;
    const full = tee(angles, 'false,false', frame);
    const angle = ((67 + rotation) * Math.PI) / 180;

    const facing = (v: { y: number; z: number }) => v.y * Math.cos(angle) + v.z * Math.sin(angle);

    expect(full.meshes).toHaveLength(2);
    expect(full.meshes[0].vertices.some((v) => facing(v) > 1)).toBe(true);
    expect(full.meshes[0].vertices.some((v) => facing(v) < -1)).toBe(true);

    for (const [hideUpper, hideLower] of [
      [true, false],
      [false, true],
      [true, true],
    ]) {
      const scene = tee(angles, `${hideUpper},${hideLower}`, frame);
      expect(scene.meshes.map((mesh) => mesh.apiName)).toEqual(
        !hideUpper || !hideLower
          ? ['makeTubeToTubeIntersection.main', 'makeTubeToTubeIntersection.branch']
          : ['makeTubeToTubeIntersection.branch'],
      );
      const branch = scene.meshes.at(-1)!;
      expect(branch.vertices).toEqual(full.meshes[1].vertices);
      expect(branch.indices).toEqual(full.meshes[1].indices);
      if (hideUpper && hideLower) continue;
      const sign = hideUpper ? -1 : 1;
      const vertices = scene.meshes[0].vertices;
      expect(vertices.every((v) => sign * facing(v) >= -0.0001)).toBe(true);
      expect(vertices.some((v) => sign * facing(v) > 1)).toBe(true);
    }
  });

  it.each(['vx', 'vx,vy'])('uses only the two declared hide flags (frame=%s)', (frame) => {
    for (const options of ['false,false', 'true,false', 'false,true', 'true,true']) {
      const expected = tee('135,90,0', options, frame);
      for (const extra of ['false', 'true']) {
        const actual = tee('135,90,0', `${options},${extra}`, frame);
        expect(actual).toEqual(expected);
      }
    }
  });

  it.each([
    ['vx', 'vy'],
    ['-vx', '-vy'],
    ['vy', '-vx'],
    ['-vy', 'vx'],
    ['vz', 'vx'],
    ['-vz', '-vx'],
    ['FdVector3d(2,4,6)', 'FdVector3d(-4,2,0)'],
    ['FdVector3d(-2,-4,-6)', 'FdVector3d(4,-2,0)'],
    ['FdVector3d(0.01,0.005,1)', 'FdVector3d(1,0,-0.01)'],
    ['FdVector3d(0.02,0.01,1)', 'FdVector3d(-0.01,0.02,0)'],
  ])('uses the SDK default up vector for %s', (normal, up) => {
    const implicit = tee('135,90,0', 'false,false', normal);
    const explicit = tee('135,90,0', 'false,false', `${normal},${up}`);
    expect(implicit.meshes).toHaveLength(explicit.meshes.length);
    implicit.meshes.forEach((mesh, i) => {
      const expected = explicit.meshes[i];
      expect(mesh.indices).toEqual(expected.indices);
      expect(mesh.vertices).toHaveLength(expected.vertices.length);
      mesh.vertices.forEach((v, j) => near(point(v), point(expected.vertices[j])));
    });
  });
});

describe('makeSpheroidSection default frame', () => {
  it.each([
    ['vx', 'vy'],
    ['-vx', '-vy'],
    ['vy', '-vx'],
    ['-vy', 'vx'],
    ['vz', 'vx'],
    ['-vz', '-vx'],
    ['FdVector3d(2,4,6)', 'FdVector3d(-4,2,0)'],
    ['FdVector3d(0.01,0.005,1)', 'FdVector3d(1,0,-0.01)'],
    ['FdVector3d(0.02,0.01,1)', 'FdVector3d(-0.01,0.02,0)'],
  ])('matches the SDK perpendicular for %s', (normal, bVector) => {
    const result = new GeometryRuntime().executeUpToLine(
      `double lat[2]={20,130}, lon[2]={30,170}, axes[3]={80,60,40};
int n[2]={4,6};
makeSpheroidSection(FdPoint3d(3,5,7), ${normal}, lat, lon, axes, n);
makeSpheroidSection(FdPoint3d(3,5,7), ${normal}, ${bVector}, lat, lon, axes, n);`,
      999,
    );
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(2);
    const [implicit, explicit] = scene.meshes;
    expect(implicit.indices).toEqual(explicit.indices);
    expect(implicit.vertices).toEqual(explicit.vertices);
  });
});

describe('CGeneral mesh regressions', () => {
  it.each([0, 50])('keeps the rectangle-to-ellipse surface with zero tube length (offset=%s)', (offset) => {
    const result = new GeometryRuntime().executeUpToLine(
      `
double hw[2]={100,120}, tube[3]={60,40,0};
makeRectToTubeTransition(FdPoint3d(), vz, vx, hw, FdPoint3d(0,0,${offset}), tube, 10);`,
      999,
    );
    expect(result.diagnostics).toEqual([]);
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0].apiName).toBe('makeRectToTubeTransition.transition');
    expect(scene.meshes[0].indices.length).toBeGreaterThan(0);
    expectFiniteScene(scene);
    expect(Math.max(...scene.meshes[0].vertices.map((v) => v.z))).toBe(offset);
    if (offset === 0) {
      let area = 0;
      const mesh = scene.meshes[0];
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index]);
        area += Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
      }
      expect(area).toBeCloseTo(100 * 120 - (40 / 2) * Math.sin((2 * Math.PI) / 40) * 30 * 20, 2);
    }
  });

  it('reports invalid SAN_GRILL coordinates without emitting NaN or hiding valid calls', () => {
    const result = new GeometryRuntime().executeUpToLine(
      `
double d=60, r=(d-10)/2, dd=d/20;
double a=(5+1)*dd*sqrt(2.0), b=sqrt(r*r-a*a);
makeSymbolicLine(FdPoint3d(a,b,0), FdPoint3d(a,-b,0));
makeFlatDisc(FdPoint3d(), vz, 40, 2);`,
      999,
    );
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([
      'line 4 makeSymbolicLine: mesh contains non-finite values or invalid indices; mesh omitted',
    ]);
    expect(scene.meshes.map((m) => m.apiName)).toEqual(['makeFlatDisc']);
    expectFiniteScene(scene);
  });

  it('rejects a non-finite transform/color while retaining the previous valid state', () => {
    const result = new GeometryRuntime().executeUpToLine(
      `
preTransformMesh(FdVector3d(0,0,7));
setMeshColor(255,0,0);
preTransformMesh(sqrt(-1.0), vz);
setMeshColor(sqrt(-1.0),128,255);
makeFlatDisc(FdPoint3d(), vz, 40, 2);`,
      999,
    );
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([
      'line 4 preTransformMesh: invalid mesh transform arguments',
      'line 5 setMeshColor: color arguments must be finite',
    ]);
    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0].color).toEqual({ r: 1, g: 0, b: 0 });
    expect(scene.meshes[0].vertices.every((v) => v.z === 7)).toBe(true);
    expectFiniteScene(scene);
  });

  it('continues to reject missing section diameters instead of inventing a last radius', () => {
    const result = new GeometryRuntime().executeUpToLine(
      `
FdPoint3d p[3]={FdPoint3d(),FdPoint3d(0,0,10),FdPoint3d(0,0,10)};
double diams[2]={20,20};
makeStraightTube(p, diams, 10, 2);`,
      999,
    );
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.meshes).toEqual([]);
    expect(scene.warnings).toEqual([
      'line 4 makeStraightTube: centerPoints and diams must contain numOfSegs+1 sections',
    ]);
  });
});

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('preview geometry and literal connectors match', () => {
      expectedOutput(fixture).runs.forEach((run: Json) => {
        const scene = new PreviewGeometryEngine().build(decodeResult(run.result));
        expectSameJson({ line: run.line, scene: run.scene }, { line: run.line, scene: encodeScene(scene) });
        expectFiniteScene(scene);

        fixture.connectors.forEach((directive, index) => {
          const fields = [
            directive.diameter,
            directive.aSize,
            directive.bSize,
            ...directive.position,
            ...directive.angles,
          ];
          if (!fields.every(isLiteral)) return;
          let actual;
          try {
            actual = {
              preview: encodeConnector(buildConnectorPreview(connectorDefinition(directive), literalEvaluator)),
              error: null,
            };
          } catch (e) {
            actual = { preview: null, error: what(e) };
          }
          expectSameJson({ connector: index, ...run.connectors[index] }, { connector: index, ...actual });
        });
      });
    });
  });
}
