import { FdBowlInfo } from '@engine/runtime';
import { appendBowlMeshes } from '@engine/geometry/builders/bowlMeshes';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';

function bowl(subtraction: boolean): ApiMeshAdapter {
  return withAdapterErrors('invalid bowl', (scene, context, [outer, inner]) => {
    if (!(outer instanceof FdBowlInfo)) return false;
    appendBowlMeshes(scene, context, outer, inner, subtraction);
  });
}

export const bowlAdapters: AdapterTable = {
  makeSimpleBowl: bowl(false),
  makeBowlSubstraction: bowl(true),
};
