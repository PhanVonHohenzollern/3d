import { debugValueText } from '../../helpers/debugValueText';
import { apiDebugItemId } from '../../helpers/debugItems';
import { clamp } from '../../utils/math';
import { QVector3D } from '../../utils/Vector3D';
import { apiParameterMetadataForCall, type ApiParameterMetadata } from '../runtime/ApiMetadata';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '../runtime/DebugAnchorResolver';
import type { RuntimeApiCall, RuntimeResult } from '../runtime/RuntimeTypes';
import { isPoint } from '../runtime/RuntimeValue';
import { DebugItem } from './DebugItem';
import type { VertexArray } from './VertexArray';

export const kOverviewPointName = 'p0';

export interface DebugItemsBuild {
  items: DebugItem[];
  debugSceneScale: number;
}

function sourceLabel(call: RuntimeApiCall, metadata: readonly ApiParameterMetadata[], formal: string): string {
  for (let p = 0; p < call.argumentExpressions.length; ++p) {
    const name =
      call.userFunctionCall && p < call.formalParameterNames.length
        ? call.formalParameterNames[p]
        : p < metadata.length
          ? metadata[p].name
          : '';
    if (name !== '' && (formal === name || formal.startsWith(`${name}[`)))
      return call.argumentExpressions[p] + formal.slice(name.length);
  }
  return formal;
}

function vectorDisplayScale(maxPointRadius: number, maxVectorLength: number): number {
  if (maxVectorLength > 1e-6 && maxPointRadius > 8) {
    const desired = Math.max(1.5, maxPointRadius * 0.16);
    if (maxVectorLength < desired) return Math.min(100, desired / maxVectorLength);
  }
  return 1;
}

export function buildDebugItems(result: RuntimeResult): DebugItemsBuild {
  const items: DebugItem[] = [];
  let maxPointRadius = 0;
  let maxVectorLength = 0;

  for (const variable of result.variables) {
    if (variable.name !== kOverviewPointName) continue;
    const point = variable.value;
    if (!isPoint(point)) break;
    const item = new DebugItem();
    item.name = item.label = kOverviewPointName;
    item.valueText = debugValueText(point);
    item.rawValue = new QVector3D(point.x, point.y, point.z);
    item.start = item.end = item.rawValue;
    maxPointRadius = item.rawValue.length();
    items.push(item);
    break;
  }

  for (let apiIndex = 0; apiIndex < result.apiCalls.length; ++apiIndex) {
    const call = result.apiCalls[apiIndex];
    const metadata = apiParameterMetadataForCall(call);
    for (const snapshot of resolveDebugPointSnapshots(call)) {
      const item = new DebugItem();
      item.kind = 'Point';
      item.apiIndex = apiIndex;
      item.apiSnapshot = true;
      item.label = sourceLabel(call, metadata, snapshot.name);
      item.name = apiDebugItemId(apiIndex, 'point', snapshot.name);
      item.valueText = debugValueText(snapshot.point);
      item.rawValue = new QVector3D(snapshot.point.x, snapshot.point.y, snapshot.point.z);
      item.start = item.rawValue;
      item.end = item.rawValue;
      maxPointRadius = Math.max(maxPointRadius, item.start.length());
      items.push(item);
    }

    for (const placement of resolveDebugVectorAnchors(call)) {
      const item = new DebugItem();
      item.kind = 'Vector';
      item.apiIndex = apiIndex;
      item.apiSnapshot = true;
      item.label = placement.sourceName;
      item.name = apiDebugItemId(apiIndex, 'vector', placement.parameterName);
      item.valueText = debugValueText(placement.direction);
      item.rawValue = new QVector3D(placement.direction.x, placement.direction.y, placement.direction.z);
      item.start = new QVector3D(placement.anchor.x, placement.anchor.y, placement.anchor.z);
      maxPointRadius = Math.max(maxPointRadius, item.start.length());
      maxVectorLength = Math.max(maxVectorLength, item.rawValue.length());
      items.push(item);
    }
  }

  const scale = vectorDisplayScale(maxPointRadius, maxVectorLength);
  for (const item of items) {
    if (item.kind !== 'Vector') continue;
    item.end = item.start.add(item.rawValue.mul(scale));
  }
  return { items, debugSceneScale: Math.max(10, Math.max(maxPointRadius, maxVectorLength)) };
}

export function appendVectorArrow(
  vertices: VertexArray,
  item: DebugItem,
  selected: boolean,
  eye: QVector3D,
  sceneScale: number,
): void {
  const delta = item.end.sub(item.start);
  const length = delta.length();
  if (length <= 1e-6) return;

  const r = selected ? 1.0 : 0.2;
  const g = selected ? 0.92 : 0.78;
  const b = selected ? 0.2 : 1.0;

  vertices.appendLine(item.start, item.end, r, g, b);

  const direction = delta.div(length);
  let toCamera = eye.sub(item.end);
  if (toCamera.lengthSquared() < 1e-8) toCamera = new QVector3D(0, 0, 1);
  else toCamera = toCamera.normalize();

  let side = QVector3D.crossProduct(direction, toCamera);
  if (side.lengthSquared() < 1e-8) {
    const fallback = Math.abs(direction.z) < 0.9 ? new QVector3D(0, 0, 1) : new QVector3D(0, 1, 0);
    side = QVector3D.crossProduct(direction, fallback);
  }
  side = side.normalize();

  const headLength = clamp(length * 0.18, Math.max(0.12, sceneScale * 0.006), Math.max(0.5, sceneScale * 0.035));
  const wing = headLength * 0.52;
  const base = item.end.sub(direction.mul(headLength));

  vertices.appendLine(item.end, base.add(side.mul(wing)), r, g, b);
  vertices.appendLine(item.end, base.sub(side.mul(wing)), r, g, b);
}
