import { runtimeError } from '@engine/runtime/cpp/cpp';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import {
  isPoint,
  isVector,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeNumber,
  RuntimeStdVector,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { isSymbol, scanTopLevel, TokKind, type Token } from '@engine/runtime/helpers/tokens';

// The '.' of a top-level method call in a statement (`a[i].rotateBy(...)`), or -1.
export function mutatingMethodDot(tokens: readonly Token[]): number {
  const dot = scanTopLevel(
    tokens,
    0,
    (token, i, depth) =>
      depth === 0 &&
      i + 2 < tokens.length &&
      isSymbol(token, '.') &&
      tokens[i + 1].kind === TokKind.Identifier &&
      isSymbol(tokens[i + 2], '('),
  );

  return dot < tokens.length ? dot : -1;
}

type Mutation = (
  target: RuntimeValue,
  args: readonly RuntimeValue[],
) => FdPoint3d | FdVector3d | RuntimeStdVector | null;

// Methods that replace the value they are called on (p.rotateBy(a, v) changes p). The only table of
// them: a statement or expression calling one of these writes the result back to the variable.
const kMutations: Readonly<Record<string, Mutation>> = {
  push_back(target, args) {
    if (!(target instanceof RuntimeStdVector) || args.length !== 1)
      throw runtimeError('std::vector::push_back requires one element');
    if (target.elements.length >= 1000000) throw runtimeError('std::vector exceeds 1000000 elements');
    const next = runtimeDeepCopy(target) as RuntimeStdVector;
    next.elements.push(runtimeDeepCopy(runtimeCoerceToType(args[0], target.elementType)));
    next.dimensions[0] = next.elements.length;

    return next;
  },
  rotateBy(target, args) {
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
  },
  normalize(target) {
    if (!isVector(target)) throw runtimeError('normalize requires FdVector3d');

    return target.normalize();
  },
  mirror(target, args) {
    const normal = args[0];
    if (!isVector(target) || args.length !== 1 || !isVector(normal))
      throw runtimeError('mirror requires FdVector3d normal');

    return target.mirror(normal);
  },
  set(target, args) {
    if (args.length !== 3) throw runtimeError('set requires x, y, z');
    const x = runtimeNumber(args[0]),
      y = runtimeNumber(args[1]),
      z = runtimeNumber(args[2]);
    if (isPoint(target)) return new FdPoint3d(x, y, z);
    if (isVector(target)) return new FdVector3d(x, y, z);

    return null;
  },
};

export function isMutatingMethod(method: string): boolean {
  return Object.hasOwn(kMutations, method);
}

// The value after the method ran, or null when this type has no such mutating method.
export function mutatedValue(
  method: string,
  target: RuntimeValue,
  args: readonly RuntimeValue[],
): FdPoint3d | FdVector3d | RuntimeStdVector | null {
  return kMutations[method](target, args);
}
