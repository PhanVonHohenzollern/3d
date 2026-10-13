import type { DebugLabelPanelsLayout } from '@/widgets/viewport/lib/render/types';
import { QRect } from '@/widgets/viewport/lib/math/Rect';

const kSelectionButtonWidth = 96;
const kSelectionButtonHeight = 32;
const kSelectionButtonMargin = 8;
const kPanelMargin = 8;
const kMaximumColumnWidth = 340;
const kMaximumPointColumnWidth = 440;
const kHeaderOnlyHeight = 25;

export interface DebugLabelPanelsLayoutInput {
  extraControlHeight?: number;
  topRightInset?: number;
  width: number;
  height: number;
  pointContentHeight: number;
  pointPreferredWidth?: number;
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
  const availableHeight = Math.max(
    0,
    height - buttonHeight - 3 * kSelectionButtonMargin - (input.extraControlHeight ?? 0),
  );
  const inset = input.topRightInset ?? 0;
  const vectorHeight = Math.max(0, availableHeight - inset);
  const show = input.showLabels && availableHeight >= 50 && columnWidth >= 60;
  const vectorVisible = show && input.apiFocusActive && vectorHeight >= 50 && vectorContentHeight > kHeaderOnlyHeight;
  const pointWidth = Math.max(
    0,
    Math.min(
      input.pointPreferredWidth ?? kMaximumPointColumnWidth,
      width - 2 * kPanelMargin - Math.max(inset, vectorVisible ? columnWidth + kPanelMargin : 0),
    ),
  );

  return {
    button,
    point: new QRect(kPanelMargin, kPanelMargin, pointWidth, Math.min(availableHeight, pointContentHeight)),
    vector: new QRect(
      width - kPanelMargin - columnWidth,
      kPanelMargin + inset,
      columnWidth,
      Math.min(vectorHeight, vectorContentHeight),
    ),
    pointVisible: show && pointContentHeight > kHeaderOnlyHeight,
    vectorVisible,
  };
}
