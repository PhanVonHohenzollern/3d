import {
  connectorOrientations,
  type ConnectorDefinition,
  type ConnectorPreview,
  type ConnectorType,
} from '../core/geometry/ConnectorPreview';
import type { RuntimeResult } from '../core/runtime/RuntimeTypes';
import { formatGeneral } from '../utils/cpp';
import { sameItems } from '../utils/arrays';

export const kConnectorTypes: readonly ConnectorType[] = ['Circular', 'Rectangular'];
export const kOrientationLabels = ['X+', 'X-', 'Y+', 'Y-', 'Z+', 'Z-'] as const;
export const kLinkTableHeaders = ['Connector', 'Point', 'Type', 'Position', 'Preview'];
export const kAxisLabels = ['X', 'Y', 'Z'];
export const kSizePlaceholder = 'get_val variable / expression';
export const kAngleLabels = ['a / X (deg)', 'b / Y (deg)', '\u03b3 / Z (deg)'];

export function coordinatesText(point: { x: number; y: number; z: number }): string {
  return `(${formatGeneral(point.x, 8)}, ${formatGeneral(point.y, 8)}, ${formatGeneral(point.z, 8)})`;
}

export function copyDefinition(d: ConnectorDefinition): ConnectorDefinition {
  return { ...d, position: [...d.position], angles: [...d.angles] };
}

export function connectorGeometryChanged(d: ConnectorDefinition, previous: ConnectorDefinition): boolean {
  return (
    d.type !== previous.type ||
    d.orientation !== previous.orientation ||
    d.diameter !== previous.diameter ||
    d.aSize !== previous.aSize ||
    d.bSize !== previous.bSize ||
    !sameItems(d.position, previous.position) ||
    !sameItems(d.angles, previous.angles)
  );
}

export function uniquePointName(definitions: readonly ConnectorDefinition[], firstIndex: number): string {
  let pointIndex = firstIndex;
  let name: string;
  do {
    name = `linkPoint${pointIndex++}`;
  } while (definitions.some((other) => other.pointName === name));

  return name;
}

export function pointNameError(definitions: readonly ConnectorDefinition[], id: number, name: string): string {
  if (name === '') return 'Point name cannot be empty';
  if (definitions.some((other) => other.id !== id && other.pointName === name)) return 'Point name is already used';

  return '';
}

export function linkTableTexts(d: ConnectorDefinition, preview: ConnectorPreview | null): string[] {
  const position = preview ? coordinatesText(preview.point) : `(${d.position[0]}, ${d.position[1]}, ${d.position[2]})`;

  return [d.name, d.pointName, d.type === 'Circular' ? 'Circular' : 'Rectangular', position];
}

export function connectorStatusText(preview: ConnectorPreview): string {
  return (
    `${preview.pointName} = ${coordinatesText(preview.point)}\n` +
    `Direction = ${coordinatesText(preview.direction)}; test length = ${formatGeneral(preview.length, 8)}`
  );
}

export function linkParameterNames(result: RuntimeResult): string[] {
  const names: string[] = [];
  for (const request of result.parameterRequests) {
    if (request.sourceFunction !== 'get_val' || request.type === 'string') continue;
    const name = request.variableName === '' ? request.name : request.variableName;
    if (!names.includes(name)) names.push(name);
  }

  return names;
}

export const connectorTypeIndex = (type: ConnectorType): number => kConnectorTypes.indexOf(type);

export const orientationIndex = (definition: ConnectorDefinition): number =>
  connectorOrientations.indexOf(definition.orientation);
