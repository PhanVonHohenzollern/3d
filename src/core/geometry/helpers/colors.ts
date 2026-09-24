import { stdClamp } from '../../../utils/cppStd';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import type { PreviewColor } from '../previewScene';
import { asInt, asNumber, ref } from './valueDecoding';

function colorComponent(v: number): number {
  return Math.fround(stdClamp(v / 255.0, 0.0, 1.0));
}

function acadIndexColor(index: number): PreviewColor {
  switch (index) {
    case 1:
      return { r: 1.0, g: 0.0, b: 0.0 };
    case 2:
      return { r: 1.0, g: 1.0, b: 0.0 };
    case 3:
      return { r: 0.0, g: 1.0, b: 0.0 };
    case 4:
      return { r: 0.0, g: 1.0, b: 1.0 };
    case 5:
      return { r: 0.0, g: 0.0, b: 1.0 };
    case 6:
      return { r: 1.0, g: 0.0, b: 1.0 };
    case 7:
      return { r: 1.0, g: 1.0, b: 1.0 };
    default: {
      const gray = Math.fround(stdClamp(index, 0, 255) / 255.0);

      return { r: gray, g: gray, b: gray };
    }
  }
}

export type MeshColorUpdate = { color: PreviewColor } | { warning: string };

export function meshColorUpdate(args: RuntimeValue[]): MeshColorUpdate {
  if (args.length === 3) {
    const r = ref(0.0),
      g = ref(0.0),
      b = ref(0.0);
    if (asNumber(args[0], r) && asNumber(args[1], g) && asNumber(args[2], b))
      return { color: { r: colorComponent(r.v), g: colorComponent(g.v), b: colorComponent(b.v) } };

    return { warning: 'RGB arguments are not numeric' };
  }
  if (args.length === 1) {
    const index = ref(0);
    if (asInt(args[0], index)) return { color: acadIndexColor(index.v) };

    return { warning: 'color-index argument is not numeric' };
  }

  return { warning: 'unsupported setMeshColor overload' };
}
