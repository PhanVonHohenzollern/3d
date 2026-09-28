import { buildConnectorPreview } from '@/core/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '@/core/geometry/PreviewGeometryEngine';
import {
  allNativeApiSignatures,
  apiParameterMetadataForCall,
  apiSignatureMetadataForCall,
} from '@/core/runtime/ApiMetadata';
import { apiParameterRole, apiSemanticsForCall, apiUsedElementCount } from '@/core/runtime/ApiSemantics';
import { what } from '@/utils/cpp';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '@/core/runtime/DebugAnchorResolver';
import { GeometryRuntime, runtimeSourceHistory } from '@/core/runtime/GeometryRuntime';
import type { RuntimeApiCall, RuntimeArgumentTrace, RuntimeResult } from '@/core/runtime/RuntimeTypes';
import { RuntimeArray } from '@/core/runtime/RuntimeValue';
import { encodeConnector, encodeNumber, encodeParameterRequest, encodeResult, encodeScene } from '@tests/support/codec';
import { connectorDefinition } from '@tests/support/connectors';
import type { Fixture } from '@tests/support/fixtures';

const xyz = (p: { x: number; y: number; z: number }) => [encodeNumber(p.x), encodeNumber(p.y), encodeNumber(p.z)];

export function callInfo(call: RuntimeApiCall) {
  const sig = apiSignatureMetadataForCall(call);
  const semantics = apiSemanticsForCall(call);

  return {
    signature: sig ? allNativeApiSignatures().indexOf(sig) : -1,
    parameterNames: apiParameterMetadataForCall(call).map((p) => p.name),
    semantics: semantics.map((s) => ({
      role: s.role,
      anchorParameter: s.anchorParameter,
      anchorBinding: s.anchorBinding,
      arrayMeaning: s.arrayMeaning,
      countParameter: s.countParameter,
      countOffset: s.countOffset,
      fixedCount: s.fixedCount,
      output: s.output,
      elementRoles: [...s.elementRoles],
    })),
    parameters: call.arguments.map((arg, i) => {
      const available = arg instanceof RuntimeArray ? arg.elements.length : 0;

      return {
        role: apiParameterRole(call, i),
        usedCount: i < semantics.length ? apiUsedElementCount(call, semantics[i], available) : null,
        elementRoles: Array.from({ length: Math.min(available, 24) }, (_, e) => apiParameterRole(call, i, [e])),
      };
    }),
    points: resolveDebugPointSnapshots(call).map((p) => ({ name: p.name, point: xyz(p.point), role: p.role })),
    vectors: resolveDebugVectorAnchors(call).map((v) => ({
      sourceName: v.sourceName,
      parameterName: v.parameterName,
      anchor: xyz(v.anchor),
      direction: xyz(v.direction),
      role: v.role,
    })),
  };
}

export function sourceHistories(result: RuntimeResult): number[][] {
  const histories: number[][] = [];

  const collect = (t: RuntimeArgumentTrace) => {
    for (const s of t.sources) histories.push(runtimeSourceHistory(result, s));
    t.elements.forEach(collect);
  };

  for (const call of result.apiCalls) call.argumentTraces.forEach(collect);

  return histories;
}

export function evaluations(runtime: GeometryRuntime, expressions: readonly string[]) {
  return expressions.map((expression) => {
    try {
      return { expression, value: encodeNumber(runtime.evaluateNumericExpression(expression)), error: null };
    } catch (e) {
      return { expression, value: null, error: what(e) };
    }
  });
}

export function connectorPreviews(runtime: GeometryRuntime, fixture: Fixture) {
  return fixture.connectors.map((directive) => {
    try {
      const preview = buildConnectorPreview(connectorDefinition(directive), (expression) =>
        runtime.evaluateNumericExpression(expression),
      );

      return { preview: encodeConnector(preview), error: null };
    } catch (e) {
      return { preview: null, error: what(e) };
    }
  });
}

export function dumpFixture(fixture: Fixture) {
  const runtime = new GeometryRuntime();
  const discoverParameters = runtime.discoverParameters(fixture.code).map(encodeParameterRequest);
  const runs = fixture.lines.map((line) => {
    runtime.setParameters(fixture.parameters);
    const result = runtime.executeUpToLine(fixture.code, line);

    return {
      line,
      result: encodeResult(result),
      callInfo: result.apiCalls.map(callInfo),
      sourceHistories: sourceHistories(result),
      scene: encodeScene(new PreviewGeometryEngine().build(result)),
      evals: evaluations(runtime, fixture.evals),
      connectors: connectorPreviews(runtime, fixture),
    };
  });

  return { discoverParameters, runs };
}
