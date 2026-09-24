import { apiSignatureMetadataForCall } from '../../runtime/ApiMetadata';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { isGeometryCallName } from '../helpers/apiCall';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';
import { appendBox } from './boxAdapter';
import {
  appendConnector,
  appendFacettedCylinder,
  appendPlane,
  appendRectFace,
  appendScrew,
} from './rectangularAdapters';
import { appendRectToTubeIntersection, appendRectToTubeTransition } from './rectToTubeAdapters';
import {
  appendDisc,
  appendDonutSection,
  appendFlatDisc,
  appendFlatRing,
  appendSpheroidSection,
  appendSymbolicCircle,
  appendTubularBend,
} from './revolvedAdapters';
import {
  appendSimpleTube,
  appendStraightTube,
  appendTube,
  appendUniVectorTube,
  appendVerySimpleTube,
} from './tubeAdapters';

type ApiMeshAdapter = (scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]) => boolean;

const primitiveAdapters = new Map<string, ApiMeshAdapter>([
  ['makeVerySimpleTube', appendVerySimpleTube],
  ['makeSimpleTube', appendSimpleTube],
  ['makeFlatDisc', appendFlatDisc],
  ['makeFlatRing', appendFlatRing],
  ['makeFacettedCylinder', appendFacettedCylinder],
  ['makeDisc', appendDisc],
  ['makeDonutSection', appendDonutSection],
  ['makeTube', appendTube],
  ['makeSpheroidSection', appendSpheroidSection],
  ['makeRectFace', appendRectFace],
  ['makeScrew', appendScrew],
  ['makeSymbolicCircle', appendSymbolicCircle],
  ['makeBox', appendBox],
  ['makeBoxFromPlanes', appendBox],
]);

const compositeAdapters = new Map<string, ApiMeshAdapter>([
  ['makePlane', appendPlane],
  ['makeRectToTubeTransition', appendRectToTubeTransition],
  ['makeRectToTubeIntersection', appendRectToTubeIntersection],
  ['makeStraightTube', appendStraightTube],
  ['makeUniVectorTube', appendUniVectorTube],
  ['makeTubularBend', appendTubularBend],
  ['makeConnector', appendConnector],
]);

const compositeGeometryHeaders = new Set([
  'SymbolsInt.h',
  'GrillsInt.h',
  'TubularPrimitivesInt.h',
  'RectangularPrimitivesInt.h',
  'VascoPrimitivesInt.h',
  'BowlPrimitivesInt.h',
  'GeoCache3dInt.h',
]);

export function appendPrimitiveApiMeshes(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const adapter = primitiveAdapters.get(context.call.name);

  return adapter !== undefined && adapter(scene, context, args);
}

export function appendCompositeApiMeshes(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const call = context.call;
  if (call.userFunctionCall) return false;

  const sig = apiSignatureMetadataForCall(call);
  const header = sig ? sig.sourceHeader : '';
  if (!compositeGeometryHeaders.has(header) && !isGeometryCallName(call.name)) return false;
  if (call.name.startsWith('append') || call.name.startsWith('calc') || call.name === 'SidePoints') return false;

  const adapter = compositeAdapters.get(call.name);

  return adapter !== undefined && adapter(scene, context, args);
}
