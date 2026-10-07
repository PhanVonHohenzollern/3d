import { stdMax, isArray, type FdPoint3d, type FdVector3d, type RuntimeValue } from '@engine/runtime';
import { DVec3, normalized } from '@engine/math';
import { buildBoxMesh, buildConnectorFlangeMesh } from '@engine/geometry/builders/rectangularMeshes';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { sdkPerpVector, toFdVector, toVec, validDirection } from '@engine/geometry/helpers/geometryMath';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable } from '@engine/geometry/adapters/types';

const noConnector = 5;
const defaultConnectorWidth = 30.0;

// Whether a value is one the SDK's bool, int and double parameters accept.
function isScalar(value: RuntimeValue): value is number | bigint | boolean {
  return typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean';
}

function sectionVectors(a: NamedArguments, name: string, count: number): FdVector3d[] {
  const vectors = a.vectorArray(name);
  if (vectors.length < count + 1) throw new Error(`makeBox ${name} must contain count+1 entries`);

  return vectors.slice(0, count + 1);
}

function sectionNormals(a: NamedArguments, count: number, centers: FdPoint3d[]): FdVector3d[] {
  if (a.has('vectors')) return sectionVectors(a, 'vectors', count);
  const normals: FdVector3d[] = [];
  for (let i = 0; i <= count; ++i) {
    let dir = new DVec3();
    if (i < count) dir = toVec(centers[i + 1]).sub(toVec(centers[i]));
    else if (i > 0) dir = toVec(centers[i]).sub(toVec(centers[i - 1]));
    normals.push(toFdVector(normalized(dir)));
  }

  return normals;
}

function sectionUpVectors(a: NamedArguments, count: number, normals: FdVector3d[]): FdVector3d[] {
  if (a.has('upVectors')) return sectionVectors(a, 'upVectors', count);

  return normals.map(sdkPerpVector);
}

// One value per section, or a single value shared by every section.
function sectionDimensions(a: NamedArguments, count: number, arrayName: string, scalarName: string): number[] {
  const name = a.has(arrayName) ? arrayName : scalarName;
  const value = a.get(name);
  if (isScalar(value)) return new Array<number>(count + 1).fill(a.real(name));
  if (!isArray(value)) throw new Error(`${name} must be a number or a number array`);
  const values = a.realArray(name);
  if (values.length < count + 1) throw new Error('makeBox width/height arguments are invalid');

  return values;
}

function visibleSides(a: NamedArguments, count: number): boolean[] {
  const supplied = a.has('sides') ? a.flagArray('sides') : [];
  const sides: boolean[] = [];
  // SDK flags run clockwise from the top; the mesh builder walks the corners in reverse.
  for (let segment = 0; segment < count; ++segment)
    for (const side of [0, 3, 2, 1]) sides.push(supplied[segment * 4 + side] ?? true);

  return sides;
}

function endCaps(a: NamedArguments): { beginning: boolean; endCap: boolean } {
  const beginName = a.has('begining') ? 'begining' : 'begin';

  return { beginning: a.optionalFlag(beginName, false), endCap: a.optionalFlag('end', false) };
}

// `connector` is either one flag per end or a single flag for both.
function connectorFlags(a: NamedArguments): boolean[] {
  const value = a.get('connector');
  if (isArray(value) && value.elements.every(isScalar)) return a.flagArray('connector');
  const both = a.optionalFlag('connector', false);

  return [both, both];
}

function connectorSettings(a: NamedArguments): { side1: number; side2: number; width: number } {
  let side1 = noConnector,
    side2 = noConnector;
  if (a.optionalFlag('connectors', false)) side1 = side2 = 0;
  const [first = false, second = false] = connectorFlags(a);
  if (first) side1 = 0;
  if (second) side2 = 0;

  return {
    side1: a.optionalInt('connector1Side', side1),
    side2: a.optionalInt('connector2Side', side2),
    width: stdMax(0.0, a.optionalReal('connectorWidth', defaultConnectorWidth)),
  };
}

function appendBox(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const count = a.int('count');
  const centers = a.pointArray('centralPoints');
  if (count < 0 || centers.length < count + 1) throw new Error('makeBox centralPoints must contain count+1 sections');

  const normals = sectionNormals(a, count, centers);
  if (!normals.every(validDirection)) throw new Error('makeBox section vector is zero');
  const upVectors = sectionUpVectors(a, count, normals);
  const widths = sectionDimensions(a, count, 'tabWidth', 'width');
  const heights = sectionDimensions(a, count, 'tabHeight', 'height');
  const sides = visibleSides(a, count);

  const { beginning, endCap } = endCaps(a);
  scene.meshes.push(
    buildBoxMesh(context, {
      count,
      centers,
      normals,
      upVectors,
      widths,
      heights,
      visibleSides: sides,
      beginCap: beginning,
      endCap,
    }),
  );

  const connectors = connectorSettings(a);

  const appendConnector = (section: number, side: number, directionSign: number) => {
    if (side === noConnector) return;
    const connector = buildConnectorFlangeMesh(
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
}

const box = withAdapterErrors('invalid makeBox arguments', appendBox);

export const boxAdapters: AdapterTable = {
  makeBox: box,
  makeBoxFromPlanes: box,
};
