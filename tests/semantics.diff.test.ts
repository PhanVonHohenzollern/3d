// Differential test: API metadata, semantics and debug anchors, run on the
// C++ runtime's RuntimeResult so this test does not depend on the TS runtime.
import { describe, it } from 'vitest';
import {
  allNativeApiSignatures,
  apiParameterMetadataForCall,
  apiSignatureMetadataForCall,
} from '../src/runtime/ApiMetadata';
import { apiParameterRole, apiSemanticsForCall, apiUsedElementCount } from '../src/runtime/ApiSemantics';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '../src/runtime/DebugAnchorResolver';
import type { RuntimeApiCall } from '../src/runtime/RuntimeTypes';
import { RuntimeArray } from '../src/runtime/RuntimeValue';
import { decodeResult, encodeNumber } from './support/codec';
import { expectSameJson } from './support/compare';
import { listFixtures } from './support/fixtures';
import { referenceOutput } from './support/reference';

const xyz = (p: { x: number; y: number; z: number }) => [encodeNumber(p.x), encodeNumber(p.y), encodeNumber(p.z)];

function callInfo(call: RuntimeApiCall) {
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

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('matches C++ API metadata, semantics and debug anchors', () => {
      const reference = referenceOutput(fixture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reference.runs.forEach((run: any) => {
        const result = decodeResult(run.result);
        expectSameJson(
          { line: run.line, callInfo: run.callInfo },
          { line: run.line, callInfo: result.apiCalls.map(callInfo) },
        );
      });
    });
  });
}
