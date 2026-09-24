// Differential test: PreviewGeometryEngine and ConnectorPreview, run on the
// C++ runtime's RuntimeResult so this test does not depend on the TS runtime.
// Connectors are compared here only when every field is a numeric literal or
// empty; tests/pipeline.diff.test.ts covers expression fields.
import { describe, it } from 'vitest';
import { buildConnectorPreview } from '../src/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '../src/geometry/PreviewGeometryEngine';
import { what } from '../src/runtime/CppCompat';
import { decodeResult, encodeConnector, encodeScene } from './support/codec';
import { expectSameJson } from './support/compare';
import { connectorDefinition, isLiteral, literalEvaluator } from './support/connectors';
import { listFixtures } from './support/fixtures';
import { referenceOutput } from './support/reference';

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('matches C++ preview geometry', () => {
      const reference = referenceOutput(fixture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reference.runs.forEach((run: any) => {
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
