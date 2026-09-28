import { runtimeError } from '@engine/runtime/cpp/cpp';
import { FdBowlCorner, FdBowlFace, FdBowlInfo } from '@engine/runtime/FdBowlData';
import {
  isArray,
  isPoint,
  isVector,
  RuntimeArray,
  runtimeInteger,
  runtimeNumber,
  runtimeTruthy,
  type RuntimeValue,
} from '@engine/runtime/values/core';
import type { ValueMethod, ValueType } from '@engine/runtime/values/types';

// Bowl objects are changed in place by their own methods, like the SDK's C++ objects.

const kUnsupportedMethod = 'unsupported bowl method: ';

const number = (args: readonly RuntimeValue[], i: number) => runtimeNumber(args[i]);

const flag = (args: readonly RuntimeValue[], i: number) => runtimeTruthy(args[i]);

// A setter method: runs `apply` and returns nothing, as the SDK's void methods do.
function setter<T>(apply: (value: T, args: readonly RuntimeValue[]) => void): ValueMethod<T> {
  return (value, args) => {
    apply(value, args);

    return undefined;
  };
}

const bowlInfoMethods: Readonly<Record<string, ValueMethod<FdBowlInfo>>> = {
  getFace: (value, args) => value.face(number(args, 0)),
  getFaceForInit: (value, args) => value.face(number(args, 0)),
  getCornersNum: (value) => BigInt(value.corners),
  setCornersNum: setter((value, args) => {
    const count = number(args, 0);
    if (!Number.isInteger(count) || count < 0 || count > 4096) throw runtimeError('invalid bowl corner count');
    value.corners = count;
    value.faces.forEach((f) => f.resize(0));
  }),
  setCopmlexity: setter((value, args) => {
    value.complexityR = number(args, 0);
    value.complexityV = number(args, 1);
  }),
  setCopmlexityR: setter((value, args) => {
    value.complexityR = number(args, 0);
  }),
  setCopmlexityV: setter((value, args) => {
    value.complexityV = number(args, 0);
  }),
  getCopmlexityR: (value) => BigInt(value.complexityR),
  getCopmlexityV: (value) => BigInt(value.complexityV),
  setCovers: setter((value, args) => {
    value.faces[0].cover = flag(args, 0);
    value.faces[1].cover = flag(args, 1);
  }),
  clearCornerInformation: setter((value) => value.faces.forEach((f) => f.resize(0))),
  turnOnDebugDrawing: setter((value, args) => {
    value.debugDrawing = flag(args, 0);
  }),
  isCompatible: (_value, args) =>
    args[0] instanceof FdBowlFace && args[1] instanceof FdBowlFace && args[0].corners.length === args[1].corners.length,
};

function radiusIndex(index: number): 0 | 1 {
  if (index !== 0 && index !== 1) throw runtimeError('radius index must be 0 or 1');

  return index;
}

const bowlFaceMethods: Readonly<Record<string, ValueMethod<FdBowlFace>>> = {
  clear: setter((value) => value.resize(0)),
  copyFrom(value, args) {
    if (!(args[0] instanceof FdBowlFace)) throw runtimeError('copyFrom requires FdBowlFace');
    Object.assign(value, args[0].clone());

    return true;
  },
  initAsRectangle: setter((value, args) => {
    const [up, direction, center, sizes] = args;
    if (!isVector(up) || !isVector(direction) || !isPoint(center) || !isArray(sizes))
      throw runtimeError('invalid bowl rectangle arguments');
    value.initAsRectangle(
      up,
      direction,
      center,
      sizes.elements.map(runtimeNumber),
      args.length > 4 && flag(args, 4),
      args.length > 5 ? number(args, 5) : 2,
    );
  }),
  getCenter: (value) => value.center,
  setCenter: setter((value, args) => {
    if (!isPoint(args[0])) throw runtimeError('setCenter requires FdPoint3d');
    value.center = args[0];
  }),
  getUpVector: (value) => value.upVector,
  setUpVector: setter((value, args) => {
    if (!isVector(args[0])) throw runtimeError('setUpVector requires FdVector3d');
    value.upVector = args[0];
  }),
  getDirection: (value) => value.direction,
  setDirection: setter((value, args) => {
    if (!isVector(args[0])) throw runtimeError('setDirection requires FdVector3d');
    value.direction = args[0];
  }),
  getVertix: (value, args) => value.corner(number(args, 0)).vertex,
  setVertix: setter((value, args) => {
    if (!isPoint(args[1])) throw runtimeError('setVertix requires FdPoint3d');
    value.corner(number(args, 0)).vertex = args[1];
  }),
  setVerticesAll: setter((value, args) => {
    const point = args[0];
    if (!isPoint(point)) throw runtimeError('setVerticesAll requires FdPoint3d');
    value.corners.forEach((c) => {
      c.vertex = point;
    });
  }),
  getRadii: (value, args) => {
    const index = radiusIndex(number(args, 1));

    return value.corner(number(args, 0)).radii[index];
  },
  setRadii: setter((value, args) => {
    const corner = value.corner(number(args, 0));
    // SDK overload: (int, double, int) selects one radius; (int, double, double) sets both.
    if (typeof args[2] === 'bigint') corner.radii[radiusIndex(number(args, 2))] = number(args, 1);
    else corner.radii = [number(args, 1), number(args, 2)];
  }),
  setRadiusAll: setter((value, args) =>
    value.corners.forEach((c) => {
      c.radii = [number(args, 0), number(args, 0)];
    }),
  ),
  getTransitionTypes: (value, args) => BigInt(value.corner(number(args, 0)).trType),
  setTransitionTypes: setter((value, args) => {
    value.corner(number(args, 0)).trType = number(args, 1);
  }),
  setTransitionTypesAll: setter((value, args) =>
    value.corners.forEach((c) => {
      c.trType = number(args, 0);
    }),
  ),
  getTruncated: (value, args) => value.corner(number(args, 0)).truncated,
  setTruncated: setter((value, args) => {
    value.corner(number(args, 0)).truncated = flag(args, 1);
  }),
  setTruncatedAll: setter((value, args) =>
    value.corners.forEach((c) => {
      c.truncated = flag(args, 0);
    }),
  ),
  setCovered: setter((value, args) => {
    value.cover = flag(args, 0);
  }),
  isCovered: (value) => value.cover,
  getCornersNum: (value) => BigInt(value.corners.length),
};

export const bowlInfoType: ValueType<FdBowlInfo> = {
  name: 'FdBowlInfo',
  constructorNames: ['FdBowlInfo'],
  is: (value): value is FdBowlInfo => value instanceof FdBowlInfo,
  create: () => new FdBowlInfo(),
  construct: (args) =>
    args[0] instanceof FdBowlInfo
      ? args[0].clone()
      : new FdBowlInfo(
          args.length > 0 ? runtimeNumber(args[0]) : 4,
          args.length > 1 ? runtimeNumber(args[1]) : 10,
          args.length > 2 ? runtimeNumber(args[2]) : 10,
        ),
  copy: (value) => value.clone(),
  describe: (value) => `FdBowlInfo(${value.corners} corners, ${value.complexityR} × ${value.complexityV})`,
  methods: bowlInfoMethods,
  members: {},
  changedInPlace: true,
  hasFields: false,
  unsupportedMethod: kUnsupportedMethod,
};

export const bowlFaceType: ValueType<FdBowlFace> = {
  name: 'FdBowlFace',
  constructorNames: ['FdBowlFace'],
  is: (value): value is FdBowlFace => value instanceof FdBowlFace,
  create: () => new FdBowlFace(),
  construct: (args) => (args[0] instanceof FdBowlFace ? args[0].clone() : new FdBowlFace()),
  copy: (value) => value.clone(),
  describe: (value) => `FdBowlFace(${value.corners.length} corners)`,
  methods: bowlFaceMethods,
  members: {},
  changedInPlace: true,
  hasFields: false,
  unsupportedMethod: kUnsupportedMethod,
};

// The SDK's FdBowlCorner struct: public fields, no methods.
export const bowlCornerType: ValueType<FdBowlCorner> = {
  name: 'FdBowlCorner',
  constructorNames: ['FdBowlCorner'],
  is: (value): value is FdBowlCorner => value instanceof FdBowlCorner,
  create: () => new FdBowlCorner(),
  construct: () => new FdBowlCorner(),
  copy: (value) => value.clone(),
  describe: (value, ops) => `FdBowlCorner(${ops.describe(value.vertex)})`,
  methods: {},
  members: {
    vertex: {
      get: (corner) => corner.vertex,
      set(corner, next, ops) {
        corner.vertex = ops.coerce(next, 'FdPoint3d') as FdBowlCorner['vertex'];
      },
    },
    // Read as an array that shares the corner's storage, so corner.radii[0] = r writes through.
    radii: { get: (corner) => new RuntimeArray('double', [2], corner.radii) },
    trType: {
      get: (corner) => BigInt(corner.trType),
      set(corner, next) {
        corner.trType = Number(runtimeInteger(next));
      },
    },
    truncated: {
      get: (corner) => corner.truncated,
      set(corner, next) {
        corner.truncated = runtimeTruthy(next);
      },
    },
  },
  changedInPlace: true,
  hasFields: true,
  unsupportedMethod: kUnsupportedMethod,
};
