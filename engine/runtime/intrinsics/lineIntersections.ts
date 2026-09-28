import { runtimeError } from '@engine/runtime/cpp/cpp';
import { createApiCall } from '@engine/runtime/helpers/apiCalls';
import { lineIntersection } from '@engine/runtime/helpers/lineIntersection';
import { readLValue } from '@engine/runtime/helpers/lvalues';
import { recordChange } from '@engine/runtime/interpreter/changes';
import { tokensToExpression } from '@engine/runtime/helpers/tokens';
import { isPoint, runtimeDeepCopy } from '@engine/runtime/RuntimeValue';
import type { LanguageIntrinsic } from '@engine/runtime/intrinsics/types';

// lineToLineInt / lineSegToLineSegInt(a0, a1, b0, b1, out): writes the intersection into `out`
// when there is one, and is recorded as an API call either way.
export const lineIntersections: LanguageIntrinsic = {
  kind: 'language',
  names: ['lineSegToLineSegInt', 'lineToLineInt'],
  statement({ state, evaluate, resolveLValue, parentApiIndex }, { name, argGroups, line }, tokens) {
    if (argGroups.length !== 5) throw runtimeError(name + ' requires 5 arguments');
    const [a0, a1, b0, b1] = argGroups.slice(0, 4).map((group) => evaluate(group));
    if (!isPoint(a0) || !isPoint(a1) || !isPoint(b0) || !isPoint(b1))
      throw runtimeError(name + ' requires four FdPoint3d inputs');
    const outRef = resolveLValue(argGroups[4]);
    const before = readLValue(outRef);
    if (!isPoint(before)) throw runtimeError(name + ' output must be FdPoint3d');
    const intersection = lineIntersection(a0, a1, b0, b1, name === 'lineSegToLineSegInt');
    if (intersection)
      recordChange(
        state,
        outRef,
        {
          line,
          operation: name,
          expression: tokensToExpression(tokens),
          sources: () => state.captureValueSources(tokensToExpression(tokens)),
        },
        () => intersection,
      );
    const args = [a0, a1, b0, b1, readLValue(outRef)].map(runtimeDeepCopy);
    state.recordApiCall(createApiCall(name, line, parentApiIndex(), args, argGroups.map(tokensToExpression)));

    return 'done';
  },
};
