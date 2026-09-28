import { describe, expect, it, vi } from 'vitest';
import * as apiMetadata from '@engine/runtime/ApiMetadata';
import { adapterMap, supportedPreviewApiNames } from '@engine/geometry/adapters/apiAdapters';
import { buildConnectorPreview } from '@engine/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '@engine/geometry/PreviewGeometryEngine';
import type { PreviewMesh } from '@engine/geometry/previewScene';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import { RuntimeArray } from '@engine/runtime/RuntimeValue';
import { what } from '@engine/runtime/cpp/cpp';
import { cross, dot, DVec3 } from '@engine/math/DVec3';
import { decodeResult, encodeConnector, encodeScene, type Json } from '@tests/support/codec';
import { expectSameJson } from '@tests/support/compare';
import { expectFiniteScene } from '@tests/support/finiteScene';
import { connectorDefinition, isLiteral, literalEvaluator } from '@tests/support/connectors';
import { expectedOutput } from '@tests/support/expected';
import { listFixtures } from '@tests/support/fixtures';

describe('rectangular connector flanges', () => {
  const bounds = (mesh: PreviewMesh) =>
    (['x', 'y', 'z'] as const).map((axis) => [
      Math.min(...mesh.vertices.map((v) => v[axis])),
      Math.max(...mesh.vertices.map((v) => v[axis])),
    ]);

  const signedArea = (mesh: PreviewMesh, normal: DVec3) => {
    let area = 0;
    const points = mesh.vertices.map((v) => new DVec3(v.x, v.y, v.z));
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3).map((index) => points[index]);
      area += dot(cross(b.sub(a), c.sub(a)), normal) / 2;
    }

    return area;
  };

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
      'makeTubeToTubeIntersection: angles needs 1 number',
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

// These fixtures pass NaN or infinity on purpose: the preview must reproduce the desktop's
// non-finite meshes for non-finite input. Anywhere else a non-finite vertex is an adapter bug.
const kNonFiniteInputFixtures = new Set(['geometry/nan_inputs.cpp']);

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('preview geometry and literal connectors match', () => {
      expectedOutput(fixture).runs.forEach((run: Json) => {
        const scene = new PreviewGeometryEngine().build(decodeResult(run.result));
        expectSameJson({ line: run.line, scene: run.scene }, { line: run.line, scene: encodeScene(scene) });
        if (!kNonFiniteInputFixtures.has(fixture.name)) expectFiniteScene(scene);

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
