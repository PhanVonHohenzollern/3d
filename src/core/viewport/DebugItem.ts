import type { DebugKind } from '../../types/viewportEngine';
import { QVector3D } from '../../utils/Vector3D';

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
