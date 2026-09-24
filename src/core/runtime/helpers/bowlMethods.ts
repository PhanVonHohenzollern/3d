import { runtimeError } from '../../../utils/cpp';
import { FdBowlInfo, FdBowlFace, type BowlValue } from '../FdBowlData';
import { isArray, isPoint, isVector, runtimeNumber, runtimeTruthy, type RuntimeValue } from '../RuntimeValue';

export function callBowlMethod(value: BowlValue, method: string, args: readonly RuntimeValue[]): RuntimeValue {
  const n = (i: number) => runtimeNumber(args[i]);

  const flag = (i: number) => runtimeTruthy(args[i]);

  if (value instanceof FdBowlInfo) {
    switch (method) {
      case 'getFace':
      case 'getFaceForInit':
        return value.face(n(0));
      case 'getCornersNum':
        return BigInt(value.corners);
      case 'setCornersNum':
        if (!Number.isInteger(n(0)) || n(0) < 0 || n(0) > 4096) throw runtimeError('invalid bowl corner count');
        value.corners = n(0);
        value.faces.forEach((f) => f.resize(0));

        return undefined;
      case 'setCopmlexity':
        value.complexityR = n(0);
        value.complexityV = n(1);

        return undefined;
      case 'setCopmlexityR':
        value.complexityR = n(0);

        return undefined;
      case 'setCopmlexityV':
        value.complexityV = n(0);

        return undefined;
      case 'getCopmlexityR':
        return BigInt(value.complexityR);
      case 'getCopmlexityV':
        return BigInt(value.complexityV);
      case 'setCovers':
        value.faces[0].cover = flag(0);
        value.faces[1].cover = flag(1);

        return undefined;
      case 'clearCornerInformation':
        value.faces.forEach((f) => f.resize(0));

        return undefined;
      case 'turnOnDebugDrawing':
        value.debugDrawing = flag(0);

        return undefined;
      case 'isCompatible':
        return (
          args[0] instanceof FdBowlFace &&
          args[1] instanceof FdBowlFace &&
          args[0].corners.length === args[1].corners.length
        );
    }
  }
  if (value instanceof FdBowlFace) {
    switch (method) {
      case 'clear':
        value.resize(0);

        return undefined;
      case 'copyFrom':
        if (!(args[0] instanceof FdBowlFace)) throw runtimeError('copyFrom requires FdBowlFace');
        Object.assign(value, args[0].clone());

        return true;
      case 'initAsRectangle': {
        const [up, direction, center, sizes] = args;
        if (!isVector(up) || !isVector(direction) || !isPoint(center) || !isArray(sizes))
          throw runtimeError('invalid bowl rectangle arguments');
        value.initAsRectangle(
          up,
          direction,
          center,
          sizes.elements.map(runtimeNumber),
          args.length > 4 && flag(4),
          args.length > 5 ? n(5) : 2,
        );

        return undefined;
      }
      case 'getCenter':
        return value.center;
      case 'setCenter':
        if (!isPoint(args[0])) throw runtimeError('setCenter requires FdPoint3d');
        value.center = args[0];

        return undefined;
      case 'getUpVector':
        return value.upVector;
      case 'setUpVector':
        if (!isVector(args[0])) throw runtimeError('setUpVector requires FdVector3d');
        value.upVector = args[0];

        return undefined;
      case 'getDirection':
        return value.direction;
      case 'setDirection':
        if (!isVector(args[0])) throw runtimeError('setDirection requires FdVector3d');
        value.direction = args[0];

        return undefined;
      case 'getVertix':
        return value.corner(n(0)).vertex;
      case 'setVertix':
        if (!isPoint(args[1])) throw runtimeError('setVertix requires FdPoint3d');
        value.corner(n(0)).vertex = args[1];

        return undefined;
      case 'setVerticesAll': {
        const point = args[0];
        if (!isPoint(point)) throw runtimeError('setVerticesAll requires FdPoint3d');
        value.corners.forEach((c) => {
          c.vertex = point;
        });

        return undefined;
      }
      case 'getRadii': {
        const index = n(1);
        if (index !== 0 && index !== 1) throw runtimeError('radius index must be 0 or 1');

        return value.corner(n(0)).radii[index];
      }
      case 'setRadii': {
        const corner = value.corner(n(0));
        // SDK overload: (int, double, int) selects one radius; (int, double, double) sets both.
        if (typeof args[2] === 'bigint') {
          const index = n(2);
          if (index !== 0 && index !== 1) throw runtimeError('radius index must be 0 or 1');
          corner.radii[index] = n(1);
        } else corner.radii = [n(1), n(2)];

        return undefined;
      }
      case 'setRadiusAll':
        value.corners.forEach((c) => {
          c.radii = [n(0), n(0)];
        });

        return undefined;
      case 'getTransitionTypes':
        return BigInt(value.corner(n(0)).trType);
      case 'setTransitionTypes':
        value.corner(n(0)).trType = n(1);

        return undefined;
      case 'setTransitionTypesAll':
        value.corners.forEach((c) => {
          c.trType = n(0);
        });

        return undefined;
      case 'getTruncated':
        return value.corner(n(0)).truncated;
      case 'setTruncated':
        value.corner(n(0)).truncated = flag(1);

        return undefined;
      case 'setTruncatedAll':
        value.corners.forEach((c) => {
          c.truncated = flag(0);
        });

        return undefined;
      case 'setCovered':
        value.cover = flag(0);

        return undefined;
      case 'isCovered':
        return value.cover;
      case 'getCornersNum':
        return BigInt(value.corners.length);
    }
  }
  throw runtimeError('unsupported bowl method: ' + method);
}
