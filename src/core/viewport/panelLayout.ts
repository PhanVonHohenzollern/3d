import type { DebugLabelPanelsLayout } from '../../types/viewportEngine';
import { QRect } from '../../utils/Rect';

const kSelectionButtonWidth = 72;
const kSelectionButtonHeight = 24;
const kSelectionButtonMargin = 8;
const kPanelMargin = 8;
const kMaximumColumnWidth = 340;
const kHeaderOnlyHeight = 25;

export interface DebugLabelPanelsLayoutInput {
  width: number;
  height: number;
  pointContentHeight: number;
  vectorContentHeight: number;
  showLabels: boolean;
  apiFocusActive: boolean;
}

export function debugLabelPanelsLayout(input: DebugLabelPanelsLayoutInput): DebugLabelPanelsLayout {
  const { width, height, pointContentHeight, vectorContentHeight } = input;
  const buttonHeight = kSelectionButtonHeight;
  const buttonWidth = Math.max(0, Math.min(width - 2 * kSelectionButtonMargin, kSelectionButtonWidth));
  const button = new QRect(
    kSelectionButtonMargin,
    Math.max(kSelectionButtonMargin, height - kSelectionButtonMargin - buttonHeight),
    buttonWidth,
    buttonHeight,
  );
  const columnWidth = Math.max(0, Math.min(kMaximumColumnWidth, Math.trunc(((width - 24) * 27) / 100)));
  const availableHeight = Math.max(0, height - buttonHeight - 3 * kSelectionButtonMargin);
  const vectorHeight = availableHeight;
  const show = input.showLabels && availableHeight >= 50 && columnWidth >= 60;
  return {
    button,
    point: new QRect(kPanelMargin, kPanelMargin, columnWidth, Math.min(availableHeight, pointContentHeight)),
    vector: new QRect(
      width - kPanelMargin - columnWidth,
      kPanelMargin,
      columnWidth,
      Math.min(vectorHeight, vectorContentHeight),
    ),
    pointVisible: show && pointContentHeight > kHeaderOnlyHeight,
    vectorVisible: show && input.apiFocusActive && vectorHeight >= 50 && vectorContentHeight > kHeaderOnlyHeight,
  };
}
