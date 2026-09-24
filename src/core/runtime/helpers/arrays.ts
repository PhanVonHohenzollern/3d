import { RuntimeArray, runtimeDefaultValueForType } from '../RuntimeValue';
import { runtimeError } from '../../../utils/cpp';
import { isSymbol, sliceTokens, splitTopLevel, type Token } from './tokens';

export function createArray(elementType: string, dims: readonly number[], level = 0): RuntimeArray {
  if (
    dims.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    dims.reduce((total, n) => total * Math.max(1, n), 1) > 1000000
  )
    throw runtimeError('array dimensions must be non-negative integers with at most 1000000 elements');
  const array = new RuntimeArray(elementType, dims.slice(level));
  const n = level < dims.length ? dims[level] : 0;
  for (let i = 0; i < n; ++i) {
    if (level + 1 < dims.length) array.elements.push(createArray(elementType, dims, level + 1));
    else array.elements.push(runtimeDefaultValueForType(elementType));
  }

  return array;
}

export const isBraceList = (tokens: readonly Token[]): boolean =>
  tokens.length >= 2 && isSymbol(tokens[0], '{') && isSymbol(tokens[tokens.length - 1], '}');

export const braceListItems = (tokens: readonly Token[]): Token[][] =>
  splitTopLevel(sliceTokens(tokens, 1, tokens.length - 1), ',');

export function inferArrayDimensions(initializer: readonly Token[], dims: number[], level = 0): void {
  if (level >= dims.length || !isBraceList(initializer)) return;
  const parts = braceListItems(initializer);
  let count = parts.length;
  if (count === 1 && parts[0].length === 0) count = 0;
  if (dims[level] === 0) dims[level] = count;
  if (level + 1 >= dims.length) return;
  let maxChild = dims[level + 1];
  for (const part of parts) {
    if (isBraceList(part)) {
      const childDims = [...dims];
      inferArrayDimensions(part, childDims, level + 1);
      maxChild = Math.max(maxChild, childDims[level + 1]);
    }
  }
  if (dims[level + 1] === 0) dims[level + 1] = maxChild;
}
