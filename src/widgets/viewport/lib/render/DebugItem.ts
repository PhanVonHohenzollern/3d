import type { DebugKind } from '@/widgets/viewport/lib/render/types';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';

export class DebugItem {
  kind: DebugKind = 'Point';
  name = '';
  label = '';
  valueText = '';
  rawValue = new QVector3D();
  start = new QVector3D();
  end = new QVector3D();
  apiIndex = -1;
  apiSnapshot = false;
}
