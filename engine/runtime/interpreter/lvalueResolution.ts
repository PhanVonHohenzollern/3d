import { runtimeError } from '@engine/runtime/cpp/cpp';
import { FdVector3d } from '@engine/runtime/FdMath';
import { arraySlot, memberSlot, type LValueRef, type RuntimeValueSlot } from '@engine/runtime/helpers/lvalues';
import { TokKind, type Token } from '@engine/runtime/helpers/tokens';
import { pathSteps } from '@engine/runtime/interpreter/paths';
import type { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import { isArray, isPoint, runtimeInteger, type RuntimeValue } from '@engine/runtime/RuntimeValue';
import { valueTypeOf } from '@engine/runtime/values/registry';
import { isVectorEnd, vectorEndIndex } from '@engine/runtime/values/stdVector';

// The storage an assignment target names: a variable, an array element, a vector's front/back, a
// struct field, or a point/vector component (the slot plus member x, y or z).
export function resolveLValue(
  tokens: readonly Token[],
  state: RuntimeState,
  evaluate: (tokens: readonly Token[]) => RuntimeValue,
): LValueRef {
  if (tokens.length === 0 || tokens[0].kind !== TokKind.Identifier) throw runtimeError('left side is not assignable');
  const root = tokens[0].text;
  if (!state.hasVariable(root)) throw runtimeError('unknown variable: ' + root);
  const path = pathSteps(tokens, 1);
  let slot: RuntimeValueSlot = state.valueSlot(root);
  let name = root;
  for (const [i, step] of path.steps.entries()) {
    const last = i === path.steps.length - 1 && path.end === tokens.length && !path.error;
    const current = slot.get();
    if (step.kind === 'index') {
      const index = runtimeInteger(evaluate(step.tokens));
      if (isPoint(current) || current instanceof FdVector3d) {
        if (index < 0n || index > 2n || !last || !step.closed) throw runtimeError('invalid point/vector component');

        return { slot, member: 'xyz'[Number(index)], path: name + `[${index}]` };
      }
      if (!isArray(current)) throw runtimeError('indexing requires array lvalue');
      if (index < 0n || index >= BigInt(current.elements.length)) throw runtimeError('array index out of range');
      slot = arraySlot(current, Number(index));
      name += `[${index}]`;
      continue;
    }
    if (isVectorEnd(current, step.name)) {
      if (step.kind !== 'call' || step.args.length !== 0)
        throw runtimeError(`std::vector::${step.name} takes no arguments`);
      const index = vectorEndIndex(current, step.name);
      slot = arraySlot(current, index);
      name += `[${index}]`;
      continue;
    }
    if (valueTypeOf(current)?.hasFields) {
      slot = memberSlot(current, step.name);
      name += '.' + step.name;
      if (step.kind === 'call') throw runtimeError('invalid lvalue near (');
      continue;
    }
    if (step.name !== 'x' && step.name !== 'y' && step.name !== 'z')
      throw runtimeError('member is not assignable: ' + step.name);
    if (!last || step.kind !== 'member') throw runtimeError('unexpected tokens after member lvalue');

    return { slot, member: step.name, path: name + '.' + step.name };
  }
  if (path.error) throw runtimeError(path.error);
  if (path.end < tokens.length) throw runtimeError('invalid lvalue near ' + tokens[path.end].text);

  return { slot, member: '', path: name };
}
