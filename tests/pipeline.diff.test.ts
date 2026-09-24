// End-to-end differential test: the complete TypeScript pipeline (runtime ->
// semantics -> geometry -> connectors) against the reference document.
import { describe, it } from 'vitest';
import { buildConnectorPreview } from '../src/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '../src/geometry/PreviewGeometryEngine';
import { what } from '../src/runtime/CppCompat';
import { GeometryRuntime } from '../src/runtime/GeometryRuntime';
import { encodeConnector, encodeResult, encodeScene } from './support/codec';
import { expectSameJson } from './support/compare';
import { connectorDefinition } from './support/connectors';
import { listFixtures } from './support/fixtures';
import { referenceOutput } from './support/reference';

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('full TypeScript pipeline matches C++', () => {
      const reference = referenceOutput(fixture);
      const runtime = new GeometryRuntime();
      fixture.lines.forEach((line, index) => {
        runtime.setParameters(fixture.parameters);
        const result = runtime.executeUpToLine(fixture.code, line);
        const run = reference.runs[index];
        expectSameJson(
          { result: run.result, scene: run.scene, connectors: run.connectors },
          {
            result: encodeResult(result),
            scene: encodeScene(new PreviewGeometryEngine().build(result)),
            connectors: fixture.connectors.map((directive) => {
              try {
                const preview = buildConnectorPreview(connectorDefinition(directive), (expression) =>
                  runtime.evaluateNumericExpression(expression),
                );
                return { preview: encodeConnector(preview), error: null };
              } catch (e) {
                return { preview: null, error: what(e) };
              }
            }),
          },
        );
      });
    });
  });
}
