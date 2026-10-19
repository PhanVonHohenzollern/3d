import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { SelectionMode } from '@/widgets/viewport/lib/render/types';

// The viewport's look and feel, in one place.

// A press that moves less than this many pixels is a click, not a drag.
export const kClickDragThreshold = 5;
export const kCameraTransitionMs = 500;
// Leave about 19% of the frame free on each side when choosing a view.
export const kViewCubeFitPadding = 1.6;
// A second click within this many pixels of the last one cycles to the next pick under the cursor.
export const kRepeatPickDistance = 5;

export const kSelectionModeNames: Readonly<Record<SelectionMode, string>> = {
  Point: 'Point',
  Vector: 'Vector',
  Mesh: 'Mesh',
};
export const kNextSelectionMode: Readonly<Record<SelectionMode, SelectionMode>> = {
  Point: 'Vector',
  Vector: 'Mesh',
  Mesh: 'Point',
};

// Label panels: title and RGB colour.
export const kPointLabels = { title: 'Points', color: [255, 174, 52] } as const;
export const kVectorLabels = { title: 'Vectors', color: [51, 199, 255] } as const;
// Room kept above the label panels for the selection buttons.
export const kExtraControlHeight = 38;
// Gap between the selection-mode and presentation buttons, and around overlay widgets that axis
// labels keep clear of.
export const kButtonGap = 6;
export const kWidgetMargin = 4;
export const kWidgetFontPointSize = 9;

// Line widths.
export const kAxisLineWidth = 1.0;
export const kWireLineWidth = 1.4;
export const kVectorLineWidth = 2.0;
export const kSelectedVectorLineWidth = 4.0;
export const kHighlightLineWidth = 3.0;
export const kConnectorLineWidth = 2.0;

// Mesh colours when selected or hovered.
export const kSelectedMeshColor = new QVector3D(0.2, 0.78, 0.95);
export const kHoverTint = { amount: 0.65, lift: new QVector3D(0.35, 0.35, 0.35) } as const;
export const kHoverOutlineColor = new QVector3D(0.7, 0.95, 1.0);
export const kConnectorColor = new QVector3D(0.18, 0.5, 0.6);

// Smallest scene radius the camera and axes are sized for.
export const kMinimumSceneScale = 10;
