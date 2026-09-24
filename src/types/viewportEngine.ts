import type { QRect, QRectF } from '../utils/Rect';
import type { QPointF } from '../utils/Vector3D';
import type { QColor } from './painting';
import type { KeyboardModifiers } from './input';
import type { FontSpec } from './text';

export interface GeometryRange {
  meshIndex: number;
  apiIndex: number;
  start: number;
  count: number;
}

export interface GpuVertexLayout {
  axesVertexCount: number;
  geometryWireVertexStart: number;
  geometryWireVertexCount: number;
  vectorVertexStart: number;
  connectorVertexStart: number;
  connectorLineStart: number;
  connectorLineCount: number;
}

export interface ConnectorVertexRanges {
  vertexStart: number;
  vertexCount: number;
  lineStart: number;
  lineCount: number;
}

export type DebugKind = 'Point' | 'Vector';

export type SelectionMode = 'Point' | 'Vector' | 'Mesh';

export interface AxisLabel {
  text: string;
  color: QColor;
  anchor: QPointF;
  bounds: QRectF;
}

export interface SelectionModeButtonState {
  text: string;
  geometry: QRect;
}

export interface DebugLabelPanelsLayout {
  button: QRect;
  point: QRect;
  vector: QRect;
  pointVisible: boolean;
  vectorVisible: boolean;
}

export interface ViewportSurface {
  glCanvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  cursorElement: HTMLElement;
  fontFamily: string;
  fontPixelSize: number;
}

export interface DebugLabelEntry {
  id: string;
  name: string;
  value: string;
}

export interface DebugLabelRowLayout {
  id: string;
  selected: boolean;
  width: number;
  nameText: string;
  nameLeft: number;
  nameWidth: number;
  valueText: string;
  valueLeft: number;
  valueWidth: number;
}

export interface DebugLabelPanelSnapshot {
  title: string;
  headerText: string;
  visible: boolean;
  geometry: QRect;
  font: FontSpec;
  color: QColor;
  rowHeight: number;
  itemWidth: number;
  scrollValue: number;
  rows: DebugLabelRowLayout[];
}

export type SelectionOp = 'Select' | 'Deselect' | 'Toggle';

export interface SelectionCommand {
  clear?: boolean;
  current?: boolean;
  op?: SelectionOp;
}

export interface SelectionEvent {
  type: 'press' | 'release' | 'move';
  button?: number;
  modifiers: KeyboardModifiers;
}
