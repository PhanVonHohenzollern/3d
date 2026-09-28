import { doubleToInt64 } from '@engine/runtime/cpp/cpp';
import { FdVector3d } from '@engine/runtime/FdMath';
import type { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import { kSdkConstants } from '@engine/runtime/SdkDefinitions';

// The names every SDK script can use without declaring them: the axis vectors, the SDK constants
// and the block's mode variables.
export function seedSdkValues(state: RuntimeState): void {
  state.setVariable('vx', new FdVector3d(1, 0, 0), false);
  state.setVariable('vy', new FdVector3d(0, 1, 0), false);
  state.setVariable('vz', new FdVector3d(0, 0, 1), false);
  for (const constant of kSdkConstants) {
    const value = constant.integer ? doubleToInt64(constant.value) : constant.value;
    // New immutable SDK constants need no variable lifetime/history. Preserve
    // existing trace identities when extending the SDK constant catalogue.
    if (constant.name.startsWith('enBowl')) state.m_values.set(constant.name, value);
    else state.setVariable(constant.name, value, false);
  }
  state.setVariable('cpx', 10n, false);
  state.setVariable('m_geoRepMode', 0n, false);
  state.setVariable('m_primitiveMode', 0n, false);
  state.m_values.set('TRUE', true);
  state.m_values.set('FALSE', false);
}
