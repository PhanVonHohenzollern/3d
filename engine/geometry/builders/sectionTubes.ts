import { stdMax } from '@engine/runtime';
import { buildSectionTubeMesh } from '@engine/geometry/builders/circularMeshes';
import { sdkPerpVector } from '@engine/geometry/helpers/geometryMath';
import type { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

// makeTube: sections given by centre, normal, optional up vector and [][2] diameters. Shared with
// makeTruncatedTube, which clips the result (its normals parameter is called `normals`).
export function appendSectionTube(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const centers = a.pointArray('centers');
  const normals = a.vectorArray(a.has('normals') ? 'normals' : 'normal');
  const upVectors = a.has('upVectors') ? a.vectorArray('upVectors') : [];
  const diameters = a.realMatrix('diams');
  const complexity = a.int('n'),
    numOfSegs = a.int('numOfSegs'),
    half = a.flag('half');
  // Checked like the SDK argument; the preview draws whole sections either way.
  a.flag('segment');
  const sections = stdMax(0, numOfSegs) + 1;
  if (
    numOfSegs < 1 ||
    complexity < 1 ||
    centers.length < sections ||
    normals.length < sections ||
    diameters.length < sections
  )
    throw new Error('makeTube arrays must contain numOfSegs+1 sections');
  if (upVectors.length === 0)
    for (let section = 0; section < sections; ++section) upVectors.push(sdkPerpVector(normals[section]));
  if (upVectors.length < sections) throw new Error('makeTube up-vector array is too small');
  for (let section = 0; section < sections; ++section)
    if (diameters[section].length < 2) throw new Error('makeTube diameters require [][2]');
  scene.meshes.push(buildSectionTubeMesh(context, centers, normals, upVectors, diameters, complexity, numOfSegs, half));
}
