import {
  isArray,
  isPoint,
  isVector,
  runtimeTypeName,
  runtimeValueToCompactString,
  type RuntimeValue,
} from '../../core/runtime/RuntimeValue';
import { UserRole } from '../treeWidget/TreeWidget';
import type { TreeWidgetItem } from '../treeWidget/TreeWidgetItem';

export const kDebugItemRole = UserRole + 1;
export const kNodeKeyRole = UserRole + 3;
export const kSourceLineRole = UserRole + 4;
export const kParameterRole = UserRole + 5;
const kArraySummaryRole = UserRole + 6;

export const TraceColumn = {
  Number: 0,
  Name: 1,
  Type: 2,
  Expression: 3,
  Value: 4,
  X: 5,
  Y: 6,
  Z: 7,
  Role: 8,
  Line: 9,
  ColumnCount: 10,
} as const;

export const kTraceHeaderLabels = [
  '#',
  'Parameter / Variable',
  'Type',
  'Expression',
  'Value',
  'X',
  'Y',
  'Z',
  'Role',
  'Line',
];

export const kSelectedTraceForeground = '#ffe4a0';

export function setValue(item: TreeWidgetItem, value: RuntimeValue): void {
  item.setText(TraceColumn.Type, runtimeTypeName(value));
  const coordinates = (x: number, y: number, z: number) => {
    item.setText(TraceColumn.X, runtimeValueToCompactString(x));
    item.setText(TraceColumn.Y, runtimeValueToCompactString(y));
    item.setText(TraceColumn.Z, runtimeValueToCompactString(z));
  };
  if (isPoint(value)) coordinates(value.x, value.y, value.z);
  else if (isVector(value)) coordinates(value.x, value.y, value.z);
  else if (isArray(value)) {
    const summary = runtimeValueToCompactString(value);
    item.setData(0, kArraySummaryRole, summary);
    item.setText(TraceColumn.Value, item.isExpanded() ? '' : summary);
  } else item.setText(TraceColumn.Value, runtimeValueToCompactString(value));
}

export function setLine(item: TreeWidgetItem, line: number): void {
  item.setData(0, kSourceLineRole, line);
  if (line > 0) item.setText(TraceColumn.Line, String(line));
}

export function updateArraySummary(item: TreeWidgetItem): void {
  if (item.hasData(0, kArraySummaryRole))
    item.setText(TraceColumn.Value, item.isExpanded() ? '' : item.dataString(0, kArraySummaryRole));
}
