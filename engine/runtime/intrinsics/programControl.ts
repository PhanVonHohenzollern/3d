import { runtimeCoerceToType } from '@engine/runtime/RuntimeValue';
import type { LanguageIntrinsic } from '@engine/runtime/intrinsics/types';

// setPrimitiveMode(mode) also sets m_primitiveMode, which scripts read back; the call itself is
// then recorded like any SDK call.
export const primitiveMode: LanguageIntrinsic = {
  kind: 'language',
  names: ['setPrimitiveMode'],
  statement({ state, evaluate }, { argGroups }) {
    if (argGroups.length === 1)
      state.setVariable('m_primitiveMode', runtimeCoerceToType(evaluate(argGroups[0]), 'int'), false);

    return 'call';
  },
};

// ASSERT(...) is a debug check in the SDK; the preview ignores it.
export const assertions: LanguageIntrinsic = {
  kind: 'language',
  names: ['ASSERT'],
  statement: () => 'done',
};

const kBaseClassCall = /^(?:FLM3Geo::)?BlockCreator3d::\w+$/;

// `BlockCreator3d::makeTube(...)` calls the SDK function itself, even when the program defines a
// function with the same name.
export function isBaseClassCall(scopedName: string): boolean {
  return kBaseClassCall.test(scopedName);
}
