import { describe, expect, it } from 'vitest';
import { buildConnectorPreview } from '../src/core/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '../src/core/geometry/PreviewGeometryEngine';
import { GeometryRuntime } from '../src/core/runtime/GeometryRuntime';
import { what } from '../src/utils/cpp';
import { decodeResult, encodeConnector, encodeScene, type Json } from './support/codec';
import { expectSameJson } from './support/compare';
import { connectorDefinition, isLiteral, literalEvaluator } from './support/connectors';
import { expectedOutput } from './support/expected';
import { listFixtures } from './support/fixtures';

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
