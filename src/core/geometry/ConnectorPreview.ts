import { CppException, what } from '../../utils/cpp';
import { FdPoint3d, FdVector3d } from '../runtime/FdMath';
import { emptyApiCall, emptyRuntimeResult } from '../runtime/RuntimeTypes';
import { RuntimeArray, type RuntimeValue } from '../runtime/RuntimeValue';
import { PreviewGeometryEngine, type PreviewMesh } from './PreviewGeometryEngine';

export type ConnectorType = 'Circular' | 'Rectangular';
export type ConnectorOrientation = 'XPositive' | 'XNegative' | 'YPositive' | 'YNegative' | 'ZPositive' | 'ZNegative';
export const connectorOrientations: readonly ConnectorOrientation[] = [
  'XPositive',
  'XNegative',
  'YPositive',
  'YNegative',
  'ZPositive',
  'ZNegative',
];

function array(type: string, values: RuntimeValue[]): RuntimeValue {
  return new RuntimeArray(type, [values.length], values);
}

export function previewOrientationDirection(orientation: ConnectorOrientation): FdVector3d {
  const directions = [
    new FdVector3d(-1, 0, 0),
    new FdVector3d(1, 0, 0),
    new FdVector3d(0, -1, 0),
    new FdVector3d(0, 1, 0),
    new FdVector3d(0, 0, -1),
    new FdVector3d(0, 0, 1),
  ];
  return directions[connectorOrientations.indexOf(orientation)];
}

export interface ConnectorDefinition {
  id: number;
  name: string;
  pointName: string;
  type: ConnectorType;
  orientation: ConnectorOrientation;
  diameter: string;
  aSize: string;
  bSize: string;
  position: [string, string, string];
  angles: [string, string, string];
}

export function defaultConnectorDefinition(): ConnectorDefinition {
  return {
    id: 0,
    name: '',
    pointName: '',
    type: 'Circular',
    orientation: 'XPositive',
    diameter: '',
    aSize: '',
    bSize: '',
    position: ['0', '0', '0'],
    angles: ['0', '0', '0'],
  };
}

export interface ConnectorPreview {
  id: number;
  name: string;
  pointName: string;
  point: FdPoint3d;
  direction: FdVector3d;
  up: FdVector3d;
  length: number;
  meshes: PreviewMesh[];
  outline: [FdPoint3d, FdPoint3d][];
}

export type ConnectorExpressionEvaluator = (expression: string) => number;

export function buildConnectorPreview(
  definition: ConnectorDefinition,
  evaluate: ConnectorExpressionEvaluator,
): ConnectorPreview {
  const field = (expression: string, name: string): number => {
    try {
      const value = evaluate(expression);
      if (!Number.isFinite(value) || Math.abs(value) > 1e8)
        throw new CppException('runtime_error', 'value must be finite and within +/-100000000');
      return value;
    } catch (e) {
      throw new CppException('runtime_error', `${name}: ${what(e)}`);
    }
  };
  const width = definition.type === 'Circular' ? field(definition.diameter, 'Diameter') : field(definition.aSize, 'A');
  const height = definition.type === 'Circular' ? width : field(definition.bSize, 'B');
  if (width <= 1e-6 || height <= 1e-6)
    throw new CppException('runtime_error', 'Diameter / A / B must be greater than 0.000001');

  const result: ConnectorPreview = {
    id: 0,
    name: '',
    pointName: '',
    point: new FdPoint3d(),
    direction: new FdVector3d(),
    up: new FdVector3d(),
    length: 0,
    meshes: [],
    outline: [],
  };
  result.id = definition.id;
  result.name = definition.name;
  result.pointName = definition.pointName === '' ? `linkPoint${definition.id}` : definition.pointName;
  result.point = new FdPoint3d(
    field(definition.position[0], 'X'),
    field(definition.position[1], 'Y'),
    field(definition.position[2], 'Z'),
  );
  result.direction = previewOrientationDirection(definition.orientation);
  result.up = Math.abs(result.direction.z) > 0.5 ? new FdVector3d(0, 1, 0) : new FdVector3d(0, 0, 1);
  const axes = [new FdVector3d(1, 0, 0), new FdVector3d(0, 1, 0), new FdVector3d(0, 0, 1)];
  const angleNames = ['a (degrees)', 'b (degrees)', 'gamma (degrees)'];
  for (let i = 0; i < axes.length; ++i) {
    const angle = (field(definition.angles[i], angleNames[i]) * Math.PI) / 180.0;
    result.direction = result.direction.rotateBy(angle, axes[i]);
    result.up = result.up.rotateBy(angle, axes[i]);
  }
  result.direction = result.direction.normalize();
  result.up = result.up.normalize();
  result.length = (width < height ? height : width) * 0.35;
  const end = result.point.add(result.direction.mul(result.length));

  const call = emptyApiCall();
  if (definition.type === 'Circular') {
    call.name = 'makeVerySimpleTube';
    call.arguments = [result.point, end, width, 64n];
  } else {
    call.name = 'makeBox';
    call.arguments = [
      1n,
      array('FdPoint3d', [result.point, end]),
      array('FdVector3d', [result.direction, result.direction]),
      array('FdVector3d', [result.up, result.up]),
      array('double', [width, width]),
      array('double', [height, height]),
      array('bool', [true, true, true, true]),
      false,
      false,
      0n,
      0n,
      0.0,
    ];
  }
  const runtime = emptyRuntimeResult();
  runtime.apiCalls.push(call);
  const geometry = new PreviewGeometryEngine().build(runtime);
  if (geometry.warnings.length !== 0) throw new CppException('runtime_error', geometry.warnings[0]);
  if (geometry.meshes.length === 0) throw new CppException('runtime_error', 'connector test produced no geometry');
  result.meshes = geometry.meshes;
  for (const mesh of result.meshes) {
    mesh.apiIndex = -1;
    mesh.color = { r: Math.fround(0.2), g: Math.fround(0.78), b: Math.fround(0.9) };
  }

  const right = result.direction.crossProduct(result.up).normal();
  const perimeter: FdVector3d[] = [];
  if (definition.type === 'Circular') {
    for (let i = 0; i < 64; ++i) {
      const angle = (i * 2.0 * Math.PI) / 64;
      perimeter.push(
        right
          .mul(Math.cos(angle))
          .add(result.up.mul(Math.sin(angle)))
          .mul(width * 0.5),
      );
    }
  } else {
    for (const [x, y] of [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ])
      perimeter.push(right.mul(x * width * 0.5).add(result.up.mul(y * height * 0.5)));
  }
  for (let i = 0; i < perimeter.length; ++i) {
    const next = perimeter[(i + 1) % perimeter.length];
    result.outline.push([result.point.add(perimeter[i]), result.point.add(next)]);
    result.outline.push([end.add(perimeter[i]), end.add(next)]);
    if (perimeter.length === 4 || i % 16 === 0)
      result.outline.push([result.point.add(perimeter[i]), end.add(perimeter[i])]);
  }
  return result;
}
