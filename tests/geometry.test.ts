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
    near(average(mesh.vertices.slice(-4)), new DVec3(reverse ? 70 : -70, 0, 130));
    expect(
      mesh.vertices
        .slice(-4)
        .map((v) => v.z)
        .sort((a, b) => a - b),
    ).toEqual([70, 70, 190, 190]);
    expect(
      mesh.vertices
        .slice(-4)
        .map((v) => v.y)
        .sort((a, b) => a - b),
    ).toEqual([-50, -50, 50, 50]);
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
    near(average([mesh.vertices[0], mesh.vertices[3]]), new DVec3(0, 0, 100));
    near(average(mesh.vertices.slice(-3, -1)), new DVec3(-40, 0, 100 + sign * 40));
  });

  const tee = (angles = '135,90,0', options = 'false,false,false', frame = 'vx,vy', offset = 10) =>
    build(`
double tube[3]={80,40,200}, position[2]={100,${offset}}, branch[3]={100,20,30};
double angles[3]={${angles}}; int complexity[2]={4,4}; bool options[]={${options}};
makeTubeToTubeIntersection(FdPoint3d(),${frame},tube,position,branch,angles,complexity,options);`);

  const tipCenter = (mesh: PreviewMesh, origin: DVec3, direction: DVec3, length: number) => {
    const tip = mesh.vertices.filter((v) => Math.abs(dot(point(v).sub(origin), direction) - length) < 0.0001);
    const unique = new Map(tip.map((v) => [[v.x, v.y, v.z].map((c) => c.toFixed(4)).join(','), v]));
    expect(unique.size).toBeGreaterThan(4);

    return average([...unique.values()]);
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

  it('hides the back half of the main tube without cutting the branch', () => {
    const full = tee('135,90,0', 'false,false,false', 'vx,vy', 0);
    const half = tee('135,90,0', 'true,true', 'vx,vy', 0);
    expect(half.meshes).toHaveLength(2);
    expect(full.meshes[0].vertices.some((v) => v.z < -1)).toBe(true);
    expect(half.meshes[0].vertices.every((v) => v.z >= -0.0001)).toBe(true);
    expect(half.meshes[1].vertices).toEqual(full.meshes[1].vertices);
    expect(half.meshes[1].indices).toEqual(full.meshes[1].indices);
  });

  it('omits only the main mesh when options[2] is true', () => {
    const full = tee(),
      branch = tee('135,90,0', 'false,false,true');
    expect(branch.meshes).toHaveLength(1);
    expect(branch.meshes[0].apiName).toBe('makeTubeToTubeIntersection.branch');
    expect(branch.meshes[0].vertices).toEqual(full.meshes[1].vertices);
    expect(branch.meshes[0].indices).toEqual(full.meshes[1].indices);
  });

  it.each([
    ['vx', 'vy'],
    ['vy', 'vx'],
    ['vz', 'vx'],
  ])('uses the SDK default up vector for %s', (normal, up) => {
    const implicit = tee('135,90,0', 'false,false,false', normal);
    const explicit = tee('135,90,0', 'false,false,false', `${normal},${up}`);
    implicit.meshes.forEach((mesh, i) => expect(mesh.vertices).toEqual(explicit.meshes[i].vertices));
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
