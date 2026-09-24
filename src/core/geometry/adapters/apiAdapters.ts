import { apiSignatureMetadataForCall } from '../../runtime/ApiMetadata';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { isGeometryCallName } from '../helpers/apiCall';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';
import { appendBox } from './boxAdapter';
import { appendTubeIntersection } from './intersectionAdapters';
import { appendSymbol, symbolApiNames } from './symbolAdapters';
import { appendBowl } from './bowlAdapters';
import { appendElbowedTube, appendRotatablePlane, appendTruncatedTube } from './pathAdapters';
import { appendDerived, derivedApiNames } from './derivedAdapters';
import { appendGrill, grillApiNames } from './grillAdapters';
import { appendFlex, flexApiNames } from './flexAdapters';
import { appendPlanar, planarApiNames } from './planarAdapters';
import { appendVasco, vascoApiNames } from './vascoAdapters';
import { appendPattern, patternApiNames } from './patternAdapters';
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
  ...planarApiNames.map((name) => [name, appendPlanar] as [string, ApiMeshAdapter]),
  ...symbolApiNames.map((name) => [name, appendSymbol] as [string, ApiMeshAdapter]),
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
  ['makeScrew2', appendScrew],
  ['makeSymbolicCircle', appendSymbolicCircle],
  ['makeBox', appendBox],
  ['makeBoxFromPlanes', appendBox],
]);

const compositeAdapters = new Map<string, ApiMeshAdapter>([
  ...patternApiNames.map((name) => [name, appendPattern] as [string, ApiMeshAdapter]),
  ...vascoApiNames.map((name) => [name, appendVasco] as [string, ApiMeshAdapter]),
  ...flexApiNames.map((name) => [name, appendFlex] as [string, ApiMeshAdapter]),
  ...derivedApiNames.map((name) => [name, appendDerived] as [string, ApiMeshAdapter]),
  ...grillApiNames.map((name) => [name, appendGrill] as [string, ApiMeshAdapter]),
  ['makeSimpleBowl', appendBowl],
  ['makeBowlSubstraction', appendBowl],
  ['makeElbowedTube', appendElbowedTube],
  ['makeTruncatedTube', appendTruncatedTube],
  ['makeRotatablePlane', appendRotatablePlane],
  ['makeTubeToTubeIntersection', appendTubeIntersection],
  ['makeTubeToTubeIntersection2', appendTubeIntersection],
  ['makePlane', appendPlane],
  ['makeRectToTubeTransition', appendRectToTubeTransition],
  ['makeRectToTubeIntersection', appendRectToTubeIntersection],
  ['makeStraightTube', appendStraightTube],
  ['makeUniVectorTube', appendUniVectorTube],
  ['makeTubularBend', appendTubularBend],
  ['makeConnector', appendConnector],
]);

export function supportedPreviewApiNames(): readonly string[] {
  return [...new Set([...primitiveAdapters.keys(), ...compositeAdapters.keys()])].sort();
}

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
