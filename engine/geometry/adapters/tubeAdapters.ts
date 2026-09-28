import { stdMax } from '@engine/runtime/cpp/cppStd';
import { DVec3, length, normalized } from '@engine/math/DVec3';
import type { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import { buildSectionTubeMesh, buildTaperedTubeMesh } from '@engine/geometry/builders/circularMeshes';
import { appendSectionTube } from '@engine/geometry/builders/sectionTubes';
import { namedAdapter } from '@engine/geometry/helpers/adapterErrors';
import { kEps, sdkPerpVector, toFdVector, toVec, validDirection } from '@engine/geometry/helpers/geometryMath';
import { pushNonEmptyMesh } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable } from '@engine/geometry/adapters/types';

// The sections of a round tube through numOfSegs+1 centres, one diameter per section.
type RoundSections = { centers: FdPoint3d[]; diams: number[]; n: number; numOfSegs: number; sections: number };

// The start and end points: two point parameters, or the FdPoint3d[2] overload.
function tubeEnds(a: NamedArguments): [FdPoint3d, FdPoint3d] {
  if (!a.has('FDcenterPoints')) return [a.point('startPoint'), a.point('endPoint')];
  const points = a.pointArray('FDcenterPoints');
  if (points.length < 2) throw new Error('FDcenterPoints must contain two points');

  return [points[0], points[1]];
}

function appendVerySimpleTube(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const [start, end] = tubeEnds(a);
  const diameter = a.real('diam'),
    segments = a.int('n');
  if (diameter <= 0.0 || segments < 1 || length(toVec(end).sub(toVec(start))) <= kEps)
    throw new Error('invalid tube dimensions');
  scene.meshes.push(buildTaperedTubeMesh(context, start, end, diameter, diameter, segments));
}

function appendSimpleTube(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const [start, end] = tubeEnds(a);
  const diameter1 = a.real('diam1'),
    diameter2 = a.real('diam2'),
    segments = a.int('n');
  if (diameter1 <= 0.0 || diameter2 <= 0.0 || segments < 1 || length(toVec(end).sub(toVec(start))) <= kEps)
    throw new Error('invalid simple-tube dimensions');
  scene.meshes.push(buildTaperedTubeMesh(context, start, end, diameter1, diameter2, segments));
}

function roundSections(a: NamedArguments, centers: FdPoint3d[]): RoundSections {
  const diams = a.realArray('diams');
  const n = a.int('n'),
    numOfSegs = a.int('numOfSegs');
  // Checked like the SDK's bool; the preview draws the same tube either way.
  a.flag('segment');
  const sections = stdMax(0, numOfSegs) + 1;
  if (n < 1) throw new Error('n must be at least 1');
  if (numOfSegs < 1) throw new Error('numOfSegs must be at least 1');
  if (centers.length < sections || diams.length < sections)
    throw new Error('centerPoints and diams must contain numOfSegs+1 sections');

  return { centers, diams, n, numOfSegs, sections };
}

function pushRoundTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  { centers, diams, n, numOfSegs, sections }: RoundSections,
  normal: FdVector3d,
): void {
  const up = sdkPerpVector(normal);
  const normals = new Array<FdVector3d>(sections).fill(normal),
    ups = new Array<FdVector3d>(sections).fill(up);
  const diameters: number[][] = [];
  for (let i = 0; i < sections; ++i) diameters[i] = [diams[i], diams[i]];
  pushNonEmptyMesh(scene, buildSectionTubeMesh(context, centers, normals, ups, diameters, n, numOfSegs, false));
}

// Every section faces along the first segment.
function appendStraightTube(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const sections = roundSections(a, a.pointArray('centerPoints'));
  const [first, second] = sections.centers;
  let axis = toVec(second).sub(toVec(first));
  if (length(axis) <= kEps) axis = new DVec3(1, 0, 0);
  pushRoundTube(scene, context, sections, toFdVector(normalized(axis)));
}

function appendUniVectorTube(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const centers = a.pointArray('centerPoints');
  const normal = a.fdVector('vector');
  const sections = roundSections(a, centers);
  if (!validDirection(normal)) throw new Error('vector must not be zero');
  pushRoundTube(scene, context, sections, normal);
}

export const tubePrimitiveAdapters: AdapterTable = {
  makeVerySimpleTube: namedAdapter('invalid tube arguments', appendVerySimpleTube),
  makeSimpleTube: namedAdapter('invalid simple-tube arguments', appendSimpleTube),
  // Both overloads, with and without upVectors, are decoded by the shared section-tube builder.
  makeTube: namedAdapter('invalid makeTube arguments', appendSectionTube),
};

export const tubeCompositeAdapters: AdapterTable = {
  makeStraightTube: namedAdapter('invalid straight tube', appendStraightTube),
  makeUniVectorTube: namedAdapter('invalid uni-vector tube', appendUniVectorTube),
};
