import { runtimeError } from '../../../utils/cpp';
import { FdPoint3d, FdVector3d } from '../FdMath';
import { isPoint, isVector, runtimeNumber, type RuntimeValue } from '../RuntimeValue';
import { isSymbol, TokKind, type Token } from './tokens';

export const kMutatingMethods: readonly string[] = ['rotateBy', 'normalize', 'mirror', 'set'];

export function mutatingMethodDot(tokens: readonly Token[]): number {
  let bracket = 0;
  for (let i = 0; i + 2 < tokens.length; ++i) {
    if (isSymbol(tokens[i], '[')) ++bracket;
    else if (isSymbol(tokens[i], ']')) --bracket;
    else if (
      bracket === 0 &&
      isSymbol(tokens[i], '.') &&
      tokens[i + 1].kind === TokKind.Identifier &&
      isSymbol(tokens[i + 2], '(')
    )
      return i;
  }

  return -1;
}

export function mutatedValue(
  method: string,
  target: RuntimeValue,
  args: readonly RuntimeValue[],
): FdPoint3d | FdVector3d | null {
  if (method === 'rotateBy') {
    const axis = args[1];
    if (isPoint(target)) {
      if (args.length < 2 || args.length > 3 || !isVector(axis))
        throw runtimeError('FdPoint3d::rotateBy(angle, axis [, point])');
      const center = args[2];

      return target.rotateBy(
        runtimeNumber(args[0]),
        axis,
        args.length === 3 && isPoint(center) ? center : new FdPoint3d(),
      );
    }
    if (isVector(target)) {
      if (args.length !== 2 || !isVector(axis)) throw runtimeError('FdVector3d::rotateBy(angle, axis)');

      return target.rotateBy(runtimeNumber(args[0]), axis);
    }

    return null;
  }
  if (method === 'normalize') {
    if (!isVector(target)) throw runtimeError('normalize requires FdVector3d');

    return target.normalize();
  }
  if (method === 'mirror') {
    const normal = args[0];
    if (!isVector(target) || args.length !== 1 || !isVector(normal))
      throw runtimeError('mirror requires FdVector3d normal');

    return target.mirror(normal);
  }
  if (args.length !== 3) throw runtimeError('set requires x, y, z');
  const x = runtimeNumber(args[0]),
    y = runtimeNumber(args[1]),
    z = runtimeNumber(args[2]);
  if (isPoint(target)) return new FdPoint3d(x, y, z);
  if (isVector(target)) return new FdVector3d(x, y, z);

  return null;
}
