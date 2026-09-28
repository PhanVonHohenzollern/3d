import { apiSignatureMetadataForCall } from '@/core/runtime/ApiMetadata';
import type { RuntimeValue } from '@/core/runtime/RuntimeValue';
import { isGeometryCallName } from '@/core/geometry/helpers/apiCall';
import type { MeshBuildContext } from '@/core/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@/core/geometry/previewScene';
import { appendBox } from '@/core/geometry/adapters/boxAdapter';
import { appendTubeIntersection } from '@/core/geometry/adapters/intersectionAdapters';
import { appendSymbol, symbolApiNames } from '@/core/geometry/adapters/symbolAdapters';
import { appendBowl } from '@/core/geometry/adapters/bowlAdapters';
import { appendElbowedTube, appendRotatablePlane, appendTruncatedTube } from '@/core/geometry/adapters/pathAdapters';
import { appendDerived, derivedApiNames } from '@/core/geometry/adapters/derivedAdapters';
import { appendGrill, grillApiNames } from '@/core/geometry/adapters/grillAdapters';
import { appendFlex, flexApiNames } from '@/core/geometry/adapters/flexAdapters';
import { appendPlanar, planarApiNames } from '@/core/geometry/adapters/planarAdapters';
import { appendVasco, vascoApiNames } from '@/core/geometry/adapters/vascoAdapters';
import { appendPattern, patternApiNames } from '@/core/geometry/adapters/patternAdapters';
import {
  appendConnector,
  appendFacettedCylinder,
  appendPlane,
  appendRectFace,
  appendScrew,
} from '@/core/geometry/adapters/rectangularAdapters';
import { appendRectToTubeIntersection, appendRectToTubeTransition } from '@/core/geometry/adapters/rectToTubeAdapters';
import {
  appendDisc,
  appendDonutSection,
  appendFlatDisc,
  appendFlatRing,
  appendSpheroidSection,
  appendSymbolicCircle,
  appendTubularBend,
} from '@/core/geometry/adapters/revolvedAdapters';
import {
  appendSimpleTube,
  appendStraightTube,
  appendTube,
  appendUniVectorTube,
  appendVerySimpleTube,
} from '@/core/geometry/adapters/tubeAdapters';

type ApiMeshAdapter = (scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]) => boolean;

// Every API name has exactly one adapter across both maps. A second registration used to
// replace the first silently, so it now fails as soon as the registry is built.
export function adapterMap(
  entries: readonly [string, ApiMeshAdapter][],
  registered: Set<string>,
): Map<string, ApiMeshAdapter> {
  const map = new Map<string, ApiMeshAdapter>();
  for (const [name, adapter] of entries) {
    if (registered.has(name)) throw new Error(`preview adapter registered twice: ${name}`);
    registered.add(name);
    map.set(name, adapter);
  }

  return map;
}

const registeredApiNames = new Set<string>();

const primitiveAdapters = adapterMap(
  [
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
  ],
  registeredApiNames,
);

const compositeAdapters = adapterMap(
  [
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
  ],
  registeredApiNames,
);

export function supportedPreviewApiNames(): readonly string[] {
  return [...primitiveAdapters.keys(), ...compositeAdapters.keys()].sort();
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
