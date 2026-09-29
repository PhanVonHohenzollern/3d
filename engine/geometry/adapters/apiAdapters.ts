import type { RuntimeValue } from '@engine/runtime';
import { isGeometryCallName } from '@engine/geometry/helpers/apiCall';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import { bowlAdapters } from '@engine/geometry/adapters/bowlAdapters';
import { boxAdapters } from '@engine/geometry/adapters/boxAdapter';
import { derivedAdapters } from '@engine/geometry/adapters/derivedAdapters';
import { flexAdapters } from '@engine/geometry/adapters/flexAdapters';
import { grillAdapters } from '@engine/geometry/adapters/grillAdapters';
import { intersectionAdapters } from '@engine/geometry/adapters/intersectionAdapters';
import { pathAdapters } from '@engine/geometry/adapters/pathAdapters';
import { patternAdapters } from '@engine/geometry/adapters/patternAdapters';
import { planarAdapters } from '@engine/geometry/adapters/planarAdapters';
import {
  rectangularCompositeAdapters,
  rectangularPrimitiveAdapters,
} from '@engine/geometry/adapters/rectangularAdapters';
import { rectToTubeAdapters } from '@engine/geometry/adapters/rectToTubeAdapters';
import { revolvedCompositeAdapters, revolvedPrimitiveAdapters } from '@engine/geometry/adapters/revolvedAdapters';
import { symbolAdapters } from '@engine/geometry/adapters/symbolAdapters';
import { tubeCompositeAdapters, tubePrimitiveAdapters } from '@engine/geometry/adapters/tubeAdapters';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { vascoAdapters } from '@engine/geometry/adapters/vascoAdapters';

// Every API name has exactly one adapter across both maps. A second registration used to
// replace the first silently, so it now fails as soon as the registry is built.
export function adapterMap(
  entries: readonly (readonly [string, ApiMeshAdapter])[],
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

const tableEntries = (tables: readonly AdapterTable[]) => tables.flatMap((table) => Object.entries(table));

// Primitive adapters draw any call with their name, including a source helper that reuses it.
const primitiveAdapters = adapterMap(
  tableEntries([
    planarAdapters,
    symbolAdapters,
    tubePrimitiveAdapters,
    revolvedPrimitiveAdapters,
    rectangularPrimitiveAdapters,
    boxAdapters,
  ]),
  registeredApiNames,
);

// Composite adapters only draw SDK calls from the composite geometry headers.
const compositeAdapters = adapterMap(
  tableEntries([
    patternAdapters,
    vascoAdapters,
    flexAdapters,
    derivedAdapters,
    grillAdapters,
    bowlAdapters,
    pathAdapters,
    intersectionAdapters,
    rectangularCompositeAdapters,
    rectToTubeAdapters,
    tubeCompositeAdapters,
    revolvedCompositeAdapters,
  ]),
  registeredApiNames,
);

const kSupportedPreviewApiNames: readonly string[] = Object.freeze(
  [...primitiveAdapters.keys(), ...compositeAdapters.keys()].sort(),
);

export function supportedPreviewApiNames(): readonly string[] {
  return kSupportedPreviewApiNames;
}

export const kCompositeGeometryHeaders: ReadonlySet<string> = new Set([
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

  const header = call.signature?.sourceHeader ?? '';
  if (!kCompositeGeometryHeaders.has(header) && !isGeometryCallName(call.name)) return false;
  if (call.name.startsWith('append') || call.name.startsWith('calc') || call.name === 'SidePoints') return false;

  const adapter = compositeAdapters.get(call.name);

  return adapter !== undefined && adapter(scene, context, args);
}
