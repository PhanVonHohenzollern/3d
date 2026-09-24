import { stdMax } from '../../../utils/cppStd';
import { DVec3, normalized } from '../../../utils/DVec3';
import { apiSignatureMetadataForCall, type ApiSignatureMetadata } from '../../runtime/ApiMetadata';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildBoxMesh, buildConnectorSleeveMesh } from '../builders/rectangularMeshes';
import { parameterIndex, warningFor } from '../helpers/apiCall';
import { sdkPerpVector, toFdVector, toVec, validDirection } from '../helpers/geometryMath';
import {
  asBool,
  asInt,
  asNumber,
  boolArray,
  numberArray,
  pointArray,
  ref,
  vectorArray,
} from '../helpers/valueDecoding';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

const noConnector = 5;

function argumentIndex(sig: ApiSignatureMetadata | null, args: RuntimeValue[], name: string): number {
  const index = parameterIndex(sig, name);

  return index >= 0 && index < args.length ? index : -1;
}

function suppliedVectors(args: RuntimeValue[], index: number, count: number): FdVector3d[] | null {
  const supplied: FdVector3d[] = [];
  if (!vectorArray(args[index], supplied) || supplied.length < count + 1) return null;

  return supplied.slice(0, count + 1);
}

function sectionNormals(
  sig: ApiSignatureMetadata | null,
  args: RuntimeValue[],
  count: number,
  centers: FdPoint3d[],
): FdVector3d[] | null {
  const vectorsIndex = argumentIndex(sig, args, 'vectors');
  if (vectorsIndex >= 0) return suppliedVectors(args, vectorsIndex, count);
  const normals: FdVector3d[] = [];
  for (let i = 0; i <= count; ++i) {
    let dir = new DVec3();
    if (i < count) dir = toVec(centers[i + 1]).sub(toVec(centers[i]));
    else if (i > 0) dir = toVec(centers[i]).sub(toVec(centers[i - 1]));
    normals.push(toFdVector(normalized(dir)));
  }

  return normals;
}

function sectionUpVectors(
  sig: ApiSignatureMetadata | null,
  args: RuntimeValue[],
  count: number,
  normals: FdVector3d[],
): FdVector3d[] | null {
  const upIndex = argumentIndex(sig, args, 'upVectors');
  if (upIndex >= 0) return suppliedVectors(args, upIndex, count);

  return normals.map(sdkPerpVector);
}

function sectionDimensions(
  sig: ApiSignatureMetadata | null,
  args: RuntimeValue[],
  count: number,
  arrayName: string,
  scalarName: string,
): number[] | null {
  let index = parameterIndex(sig, arrayName);
  if (index < 0) index = parameterIndex(sig, scalarName);
  if (index < 0 || index >= args.length) return null;
  const values: number[] = [];
  if (numberArray(args[index], values)) return values.length >= count + 1 ? values : null;
  const scalar = ref(0.0);
  if (!asNumber(args[index], scalar)) return null;

  return new Array<number>(count + 1).fill(scalar.v);
}

function visibleSides(sig: ApiSignatureMetadata | null, args: RuntimeValue[], count: number): boolean[] | null {
  const sides = new Array<boolean>(stdMax(0, count) * 4).fill(true);
  const sidesIndex = argumentIndex(sig, args, 'sides');
  if (sidesIndex < 0) return sides;
  const supplied: boolean[] = [];
  if (!boolArray(args[sidesIndex], supplied)) return null;
  for (let i = 0; i < sides.length && i < supplied.length; ++i) sides[i] = supplied[i];

  return sides;
}

function endCaps(sig: ApiSignatureMetadata | null, args: RuntimeValue[]): { beginning: boolean; endCap: boolean } {
  const beginning = ref(false),
    endCap = ref(false);
  const beginIndex =
    parameterIndex(sig, 'begining') >= 0 ? parameterIndex(sig, 'begining') : parameterIndex(sig, 'begin');
  const endIndex = parameterIndex(sig, 'end');
  if (beginIndex >= 0 && beginIndex < args.length) asBool(args[beginIndex], beginning);
  if (endIndex >= 0 && endIndex < args.length) asBool(args[endIndex], endCap);

  return { beginning: beginning.v, endCap: endCap.v };
}

function connectorSettings(
  sig: ApiSignatureMetadata | null,
  args: RuntimeValue[],
): { side1: number; side2: number; width: number } {
  const side1 = ref(noConnector),
    side2 = ref(noConnector);
  let width = 30.0;
  const connectorsIndex = argumentIndex(sig, args, 'connectors');
  if (connectorsIndex >= 0) {
    const enabled = ref(false);
    if (asBool(args[connectorsIndex], enabled) && enabled.v) side1.v = side2.v = 0;
  }
  const connectorIndex = argumentIndex(sig, args, 'connector');
  if (connectorIndex >= 0) {
    const flags: boolean[] = [];
    if (boolArray(args[connectorIndex], flags)) {
      if (flags.length !== 0 && flags[0]) side1.v = 0;
      if (flags.length > 1 && flags[1]) side2.v = 0;
    } else {
      const enabled = ref(false);
      if (asBool(args[connectorIndex], enabled) && enabled.v) side1.v = side2.v = 0;
    }
  }
  const side1Index = argumentIndex(sig, args, 'connector1Side');
  const side2Index = argumentIndex(sig, args, 'connector2Side');
  const widthIndex = argumentIndex(sig, args, 'connectorWidth');
  if (side1Index >= 0) asInt(args[side1Index], side1);
  if (side2Index >= 0) asInt(args[side2Index], side2);
  if (widthIndex >= 0) {
    const w = ref(0.0);
    if (asNumber(args[widthIndex], w)) width = stdMax(0.0, w.v);
  }

  return { side1: side1.v, side2: side2.v, width };
}

export function appendBox(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  const call = context.call;

  const warn = (reason: string) => {
    scene.warnings.push(warningFor(call, reason));

    return true;
  };

  const sig = apiSignatureMetadataForCall(call);
  const countRef = ref(0);
  const centers: FdPoint3d[] = [];
  if (args.length < 2 || !asInt(args[0], countRef) || !pointArray(args[1], centers))
    return warn('invalid makeBox count/centralPoints');
  const count = countRef.v;
  if (count < 0 || centers.length < count + 1) return warn('makeBox centralPoints must contain count+1 sections');

  const normals = sectionNormals(sig, args, count, centers);
  if (!normals) return warn('makeBox vectors must contain count+1 entries');
  if (!normals.every(validDirection)) return warn('makeBox section vector is zero');

  const upVectors = sectionUpVectors(sig, args, count, normals);
  if (!upVectors) return warn('makeBox upVectors must contain count+1 entries');

  const widths = sectionDimensions(sig, args, count, 'tabWidth', 'width');
  const heights = widths && sectionDimensions(sig, args, count, 'tabHeight', 'height');
  if (!widths || !heights) return warn('makeBox width/height arguments are invalid');

  const sides = visibleSides(sig, args, count);
  if (!sides) return warn('makeBox sides argument is invalid');

  const { beginning, endCap } = endCaps(sig, args);
  scene.meshes.push(
    buildBoxMesh(context, count, centers, normals, upVectors, widths, heights, sides, beginning, endCap),
  );

  const connectors = connectorSettings(sig, args);

  const appendConnector = (section: number, side: number, directionSign: number) => {
    if (side === noConnector) return;
    const connector = buildConnectorSleeveMesh(
      context,
      centers[section],
      normals[section],
      upVectors[section],
      widths[section],
      heights[section],
      connectors.width,
      side,
      directionSign,
    );
    connector.apiName += '.connector';
    if (connector.indices.length !== 0) scene.meshes.push(connector);
  };

  appendConnector(0, connectors.side1, -1.0);
  appendConnector(count, connectors.side2, 1.0);

  return true;
}
