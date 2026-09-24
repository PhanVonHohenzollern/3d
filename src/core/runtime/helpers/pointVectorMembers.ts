import { runtimeError } from '../../../utils/cpp';
import { FdVector3d } from '../FdMath';
import {
  isArray,
  isPoint,
  isVector,
  runtimeDeepCopy,
  runtimeNumber,
  runtimeTypeName,
  type RuntimeValue,
} from '../RuntimeValue';

function requireVectorArgument(args: readonly RuntimeValue[], message: string): FdVector3d {
  const other = args[0];
  if (args.length !== 1 || !isVector(other)) throw runtimeError(message);
  return other;
}

function perpVector(v: FdVector3d): FdVector3d {
  const n = v.normal();
  if (n.lengthSqrd() === 0.0) return new FdVector3d();
  const helper = Math.abs(n.z) < 0.85 ? new FdVector3d(0, 0, 1) : new FdVector3d(0, 1, 0);
  let p = n.crossProduct(helper);
  if (p.lengthSqrd() === 0.0) p = n.crossProduct(new FdVector3d(1, 0, 0));
  return p.normal();
}

function withinTolerance(v: FdVector3d, args: readonly RuntimeValue[]): boolean {
  return args.length === 1 && v.length() <= Math.abs(runtimeNumber(args[0]));
}

export function callMethod(value: RuntimeValue, method: string, args: readonly RuntimeValue[]): RuntimeValue {
  if (isVector(value)) {
    const v = value;
    switch (method) {
      case 'crossProduct':
        return v.crossProduct(requireVectorArgument(args, 'crossProduct requires FdVector3d'));
      case 'dotProduct':
        return v.dotProduct(requireVectorArgument(args, 'dotProduct requires FdVector3d'));
      case 'length':
        if (args.length !== 0) throw runtimeError('length takes no arguments');
        return v.length();
      case 'lengthSqrd':
        if (args.length !== 0) throw runtimeError('lengthSqrd takes no arguments');
        return v.lengthSqrd();
      case 'normal':
        if (args.length > 1) throw runtimeError('normal takes zero or one tolerance argument');
        return withinTolerance(v, args) ? new FdVector3d() : v.normal();
      case 'normalize':
        if (args.length > 1) throw runtimeError('normalize takes zero or one tolerance argument');
        return withinTolerance(v, args) ? new FdVector3d() : v.normalize();
      case 'perpVector':
        if (args.length !== 0) throw runtimeError('perpVector takes no arguments');
        return perpVector(v);
      case 'rotateBy': {
        const axis = args[1];
        if (args.length !== 2 || !isVector(axis)) throw runtimeError('FdVector3d::rotateBy requires angle and axis');
        return v.rotateBy(runtimeNumber(args[0]), axis);
      }
      case 'mirror':
        return v.mirror(requireVectorArgument(args, 'mirror requires FdVector3d'));
      case 'angleTo':
        return v.angleTo(requireVectorArgument(args, 'angleTo requires FdVector3d'));
    }
  }
  if (isPoint(value) && method === 'rotateBy') {
    const axis = args[1];
    if (args.length === 2 && isVector(axis)) return value.rotateBy(runtimeNumber(args[0]), axis);
    const center = args[2];
    if (args.length === 3 && isVector(axis) && isPoint(center))
      return value.rotateBy(runtimeNumber(args[0]), axis, center);
    throw runtimeError('FdPoint3d::rotateBy requires angle, axis [, center]');
  }
  throw runtimeError('unsupported method in expression: ' + method);
}

export function indexValue(value: RuntimeValue, index: bigint): RuntimeValue {
  if (isPoint(value) || isVector(value)) {
    if (index < 0n || index > 2n) throw runtimeError(`${runtimeTypeName(value)} index out of range`);
    return index === 0n ? value.x : index === 1n ? value.y : value.z;
  }
  if (!isArray(value)) throw runtimeError('indexing requires an array, FdPoint3d or FdVector3d');
  if (index < 0n || index >= BigInt(value.elements.length)) throw runtimeError('array index out of range');
  return runtimeDeepCopy(value.elements[Number(index)]);
}

export function memberValue(value: RuntimeValue, member: string): RuntimeValue {
  if ((isPoint(value) || isVector(value)) && (member === 'x' || member === 'y' || member === 'z')) return value[member];
  throw runtimeError('member .' + member + ' is not available on ' + runtimeTypeName(value));
}
