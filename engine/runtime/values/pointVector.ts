import { CppException, runtimeError } from '@engine/runtime/cpp/cpp';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import {
  formatNumber,
  isArray,
  isPoint,
  isVector,
  runtimeNumber,
  type RuntimeValue,
} from '@engine/runtime/values/core';
import type { ValueMember, ValueOps, ValueType } from '@engine/runtime/values/types';

type Coordinates = [number, number, number];

const kUnsupportedMethod = 'unsupported method in expression: ';

function describe(value: FdPoint3d | FdVector3d): string {
  return `(${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)})`;
}

function coordinates<T extends FdPoint3d | FdVector3d>(): Readonly<Record<string, ValueMember<T>>> {
  return { x: { get: (v) => v.x }, y: { get: (v) => v.y }, z: { get: (v) => v.z } };
}

// FdPoint3d(), FdPoint3d(other) and FdPoint3d(x, y, z); the same for FdVector3d.
function constructor<T>(name: string, make: (...xyz: Coordinates | []) => T) {
  return (args: readonly RuntimeValue[], ops: ValueOps): RuntimeValue => {
    if (args.length === 0) return make() as RuntimeValue;
    if (args.length === 1) return ops.coerce(args[0], name);
    if (args.length !== 3) throw runtimeError(name + ' constructor requires 0, 1 or 3 arguments');
    const x = runtimeNumber(args[0]),
      y = runtimeNumber(args[1]),
      z = runtimeNumber(args[2]);

    return make(x, y, z) as RuntimeValue;
  };
}

function setCoordinates<T>(make: (...xyz: Coordinates) => T) {
  return (_value: unknown, args: readonly RuntimeValue[]): RuntimeValue => {
    if (args.length !== 3) throw runtimeError('set requires x, y, z');

    return make(...(args.map(runtimeNumber) as Coordinates)) as RuntimeValue;
  };
}

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

function noArguments(name: string, args: readonly RuntimeValue[]): void {
  if (args.length !== 0) throw runtimeError(name + ' takes no arguments');
}

export const pointType: ValueType<FdPoint3d> = {
  name: 'FdPoint3d',
  constructorNames: ['FdPoint3d', 'asFdPoint3d', 'AcGePoint3d'],
  is: isPoint,
  create: () => new FdPoint3d(),
  construct: constructor('FdPoint3d', (...xyz) => new FdPoint3d(...xyz)),
  coerce(value) {
    if (isPoint(value)) return value;
    if (isArray(value) && value.elements.length >= 3)
      return new FdPoint3d(...(value.elements.slice(0, 3).map(runtimeNumber) as Coordinates));
    throw new CppException('runtime_error', 'FdPoint3d value required');
  },
  describe,
  methods: {
    set: setCoordinates((...xyz) => new FdPoint3d(...xyz)),
    rotateBy(value, args) {
      const axis = args[1];
      if (args.length === 2 && isVector(axis)) return value.rotateBy(runtimeNumber(args[0]), axis);
      const center = args[2];
      if (args.length === 3 && isVector(axis) && isPoint(center))
        return value.rotateBy(runtimeNumber(args[0]), axis, center);
      throw runtimeError('FdPoint3d::rotateBy requires angle, axis [, center]');
    },
  },
  members: coordinates(),
  changedInPlace: false,
  hasFields: false,
  unsupportedMethod: kUnsupportedMethod,
};

export const vectorType: ValueType<FdVector3d> = {
  name: 'FdVector3d',
  constructorNames: ['FdVector3d', 'asFdVector3d', 'AcGeVector3d'],
  is: isVector,
  create: () => new FdVector3d(),
  construct: constructor('FdVector3d', (...xyz) => new FdVector3d(...xyz)),
  coerce(value) {
    if (isVector(value)) return value;
    throw new CppException('runtime_error', 'FdVector3d value required');
  },
  describe,
  methods: {
    set: setCoordinates((...xyz) => new FdVector3d(...xyz)),
    crossProduct: (v, args) => v.crossProduct(requireVectorArgument(args, 'crossProduct requires FdVector3d')),
    dotProduct: (v, args) => v.dotProduct(requireVectorArgument(args, 'dotProduct requires FdVector3d')),
    length(v, args) {
      noArguments('length', args);

      return v.length();
    },
    lengthSqrd(v, args) {
      noArguments('lengthSqrd', args);

      return v.lengthSqrd();
    },
    normal(v, args) {
      if (args.length > 1) throw runtimeError('normal takes zero or one tolerance argument');

      return withinTolerance(v, args) ? new FdVector3d() : v.normal();
    },
    normalize(v, args) {
      if (args.length > 1) throw runtimeError('normalize takes zero or one tolerance argument');

      return withinTolerance(v, args) ? new FdVector3d() : v.normalize();
    },
    perpVector(v, args) {
      noArguments('perpVector', args);

      return perpVector(v);
    },
    rotateBy(v, args) {
      const axis = args[1];
      if (args.length !== 2 || !isVector(axis)) throw runtimeError('FdVector3d::rotateBy requires angle and axis');

      return v.rotateBy(runtimeNumber(args[0]), axis);
    },
    mirror: (v, args) => v.mirror(requireVectorArgument(args, 'mirror requires FdVector3d')),
    angleTo: (v, args) => v.angleTo(requireVectorArgument(args, 'angleTo requires FdVector3d')),
  },
  members: coordinates(),
  changedInPlace: false,
  hasFields: false,
  unsupportedMethod: kUnsupportedMethod,
};
