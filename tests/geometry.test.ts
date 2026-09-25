import { describe, expect, it } from 'vitest';
import { buildConnectorPreview } from '../src/core/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '../src/core/geometry/PreviewGeometryEngine';
import type { PreviewMesh } from '../src/core/geometry/previewScene';
import { apiSignatureMetadataForCall } from '../src/core/runtime/ApiMetadata';
import { GeometryRuntime } from '../src/core/runtime/GeometryRuntime';
import { RuntimeArray } from '../src/core/runtime/RuntimeValue';
import { what } from '../src/utils/cpp';
import { cross, dot, DVec3 } from '../src/utils/DVec3';
import { decodeResult, encodeConnector, encodeScene, type Json } from './support/codec';
import { expectSameJson } from './support/compare';
import { connectorDefinition, isLiteral, literalEvaluator } from './support/connectors';
import { expectedOutput } from './support/expected';
import { listFixtures } from './support/fixtures';

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
      expect(apiSignatureMetadataForCall(call)?.parameters).toHaveLength(12);
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
    expect(apiSignatureMetadataForCall(result.apiCalls[0])?.parameters).toHaveLength(13);
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

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('preview geometry and literal connectors match', () => {
      expectedOutput(fixture).runs.forEach((run: Json) => {
        const scene = new PreviewGeometryEngine().build(decodeResult(run.result));
        expectSameJson({ line: run.line, scene: run.scene }, { line: run.line, scene: encodeScene(scene) });

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
