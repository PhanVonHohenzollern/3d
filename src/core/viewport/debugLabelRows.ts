import type { FontSpec, TextMeasurer } from '../../types/text';
import type { DebugLabelEntry, DebugLabelRowLayout } from '../../types/viewportEngine';
import { elidedText, horizontalAdvance } from '../../utils/textMetrics';

const kContentLeft = 17;
const kContentMargins = 24;
const kNameValueGap = 8;
const kValuePadding = 3;
const kMaximumValuePercent = 45;

export function sameEntries(a: readonly DebugLabelEntry[], b: readonly DebugLabelEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i)
    if (a[i].id !== b[i].id || a[i].name !== b[i].name || a[i].value !== b[i].value) return false;

  return true;
}

export function labelRowLayout(
  entry: DebugLabelEntry | undefined,
  selected: boolean,
  width: number,
  baseFont: FontSpec,
  measurer: TextMeasurer,
): DebugLabelRowLayout {
  const font: FontSpec = { ...baseFont, bold: selected };
  const contentWidth = width - kContentMargins;
  const value = entry?.value ?? '';
  const valueWidth = Math.min(
    horizontalAdvance(measurer, value, font) + kValuePadding,
    Math.trunc((contentWidth * kMaximumValuePercent) / 100),
  );
  const nameWidth = Math.max(0, contentWidth - valueWidth - kNameValueGap);

  return {
    id: entry?.id ?? '',
    selected,
    width,
    nameText: elidedText(measurer, font, entry?.name ?? '', 'ElideMiddle', nameWidth),
    nameLeft: kContentLeft,
    nameWidth,
    valueText: elidedText(measurer, font, value, 'ElideRight', valueWidth),
    valueLeft: kContentLeft + contentWidth - valueWidth,
    valueWidth,
  };
}
