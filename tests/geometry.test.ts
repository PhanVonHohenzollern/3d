import { describe, it } from 'vitest';
import { buildConnectorPreview } from '../src/core/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '../src/core/geometry/PreviewGeometryEngine';
import { what } from '../src/utils/cpp';
import { decodeResult, encodeConnector, encodeScene, type Json } from './support/codec';
import { expectSameJson } from './support/compare';
import { connectorDefinition, isLiteral, literalEvaluator } from './support/connectors';
import { expectedOutput } from './support/expected';
import { listFixtures } from './support/fixtures';

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
