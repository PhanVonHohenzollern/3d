import { runtimeError } from '@engine/runtime/cpp/cpp';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import { tokensToExpression } from '@engine/runtime/helpers/tokens';
import { isArray, runtimeDeepCopy, runtimeNumber, type RuntimeValue } from '@engine/runtime/RuntimeValue';
import { recordChange } from '@engine/runtime/interpreter/changes';
import type { SdkIntrinsic } from '@engine/runtime/intrinsics/types';

type Coordinates = [number, number, number];

function tuple(value: RuntimeValue): Coordinates {
  if (!isArray(value) || value.elements.length !== 3) throw runtimeError('expected three coordinates');

  return value.elements.map(runtimeNumber) as Coordinates;
}

function setpt(_coords: Coordinates, args: readonly RuntimeValue[]): Coordinates {
  if (args.length === 2) return tuple(args[1]);
  if (args.length >= 4 && args.length <= 6)
    return [
      runtimeNumber(args[1]) * (args.length > 4 ? runtimeNumber(args[4]) : 1),
      runtimeNumber(args[2]) * (args.length > 5 ? runtimeNumber(args[5]) : 1),
      runtimeNumber(args[3]),
    ];
  throw runtimeError('setpt requires a source point or x, y, z');
}

function addpt(coords: Coordinates, args: readonly RuntimeValue[]): Coordinates {
  if (args.length !== 2) throw runtimeError('addpt requires two points');
  const offset = tuple(args[1]);

  return coords.map((v, i) => v + offset[i]) as Coordinates;
}

function rotated(coords: Coordinates, axis: FdVector3d, origin: FdPoint3d, angle: number): Coordinates {
  const point = new FdPoint3d(...coords).rotateBy(angle, axis, origin);

  return [point.x, point.y, point.z];
}

function rotate(coords: Coordinates, args: readonly RuntimeValue[]): Coordinates {
  if (args.length !== 2) throw runtimeError('invalid rotate arguments');

  return rotated(coords, new FdVector3d(0, 0, 1), new FdPoint3d(), runtimeNumber(args[1]));
}

function rotatePoint(coords: Coordinates, args: readonly RuntimeValue[]): Coordinates {
  if (args.length === 4)
    return rotated(coords, new FdVector3d(...tuple(args[1])), new FdPoint3d(...tuple(args[2])), runtimeNumber(args[3]));
  if (args.length === 8)
    return rotated(
      coords,
      new FdVector3d(...(args.slice(1, 4).map(runtimeNumber) as Coordinates)),
      new FdPoint3d(...(args.slice(4, 7).map(runtimeNumber) as Coordinates)),
      runtimeNumber(args[7]),
    );
  throw runtimeError('invalid rotatePoint arguments');
}

const kPointOperations: Readonly<Record<string, (coords: Coordinates, args: readonly RuntimeValue[]) => Coordinates>> =
  { setpt, addpt, rotate, rotatePoint };

// ads_point operations: the first argument is changed in place and the change recorded.
export const pointOperations: SdkIntrinsic = {
  kind: 'sdk',
  names: Object.keys(kPointOperations),
  update({ state, resolveLValue }, { name, argGroups, line }, args) {
    recordChange(
      state,
      resolveLValue(argGroups[0]),
      { line, operation: name, expression: tokensToExpression(argGroups[0]) },
      (before) => {
        if (!isArray(before) || before.elements.length !== 3) throw runtimeError(name + ' requires ads_point');
        const next = runtimeDeepCopy(before);
        if (isArray(next)) next.elements = kPointOperations[name](tuple(before), args);

        return next;
      },
    );
  },
};
