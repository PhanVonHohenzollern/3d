import { runtimeError } from '@engine/runtime/cpp/cpp';
import { FdVector3d } from '@engine/runtime/FdMath';
import { arraySlot, memberSlot, type LValueRef } from '@engine/runtime/helpers/lvalues';
import { isSymbol, matchingBracketEnd, sliceTokens, TokKind, type Token } from '@engine/runtime/helpers/tokens';
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
  let slot = state.valueSlot(root);
  let path = root;
  let p = 1;
  while (p < tokens.length) {
    if (isSymbol(tokens[p], '[')) {
      const begin = p + 1;
      p = matchingBracketEnd(tokens, begin).end;
      const idx = runtimeInteger(evaluate(sliceTokens(tokens, begin, p)));
      const arr = slot.get();
      if (isPoint(arr) || arr instanceof FdVector3d) {
        if (idx < 0n || idx > 2n || p + 1 !== tokens.length) throw runtimeError('invalid point/vector component');

        return { slot, member: 'xyz'[Number(idx)], path: path + `[${idx}]` };
      }
      if (!isArray(arr)) throw runtimeError('indexing requires array lvalue');
      if (idx < 0n || idx >= BigInt(arr.elements.length)) throw runtimeError('array index out of range');
      slot = arraySlot(arr, Number(idx));
      path += `[${idx}]`;
      if (p < tokens.length && isSymbol(tokens[p], ']')) ++p;
      continue;
    }
    if (isSymbol(tokens[p], '.')) {
      ++p;
      if (p >= tokens.length || tokens[p].kind !== TokKind.Identifier)
        throw runtimeError('expected member name after .');
      const member = tokens[p++].text;
      const current = slot.get();
      if (isVectorEnd(current, member)) {
        if (tokens[p]?.text !== '(' || tokens[p + 1]?.text !== ')')
          throw runtimeError(`std::vector::${member} takes no arguments`);
        const index = vectorEndIndex(current, member);
        slot = arraySlot(current, index);
        path += `[${index}]`;
        p += 2;
        continue;
      }
      if (valueTypeOf(current)?.hasFields) {
        slot = memberSlot(current, member);
        path += '.' + member;
        continue;
      }
      if (member !== 'x' && member !== 'y' && member !== 'z') throw runtimeError('member is not assignable: ' + member);
      if (p !== tokens.length) throw runtimeError('unexpected tokens after member lvalue');

      return { slot, member, path: path + '.' + member };
    }
    throw runtimeError('invalid lvalue near ' + tokens[p].text);
  }

  return { slot, member: '', path };
}
