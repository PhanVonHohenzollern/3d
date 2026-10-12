import type { FontSpec, TextMeasurer } from '@/shared/lib/text';
import type { DebugLabelEntry, DebugLabelRowLayout } from '@/widgets/viewport/lib/render/types';
import { elidedText, horizontalAdvance } from '@/shared/lib/text';

const kContentLeft = 17;
const kContentMargins = 24;
const kNameValueGap = 8;
const kValuePadding = 3;
const kMinimumNameWidth = 48;

export function sameEntries(a: readonly DebugLabelEntry[], b: readonly DebugLabelEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i].id !== b[i].id || a[i].name !== b[i].name || a[i].value !== b[i].value) return false;
    const first = a[i].details;
    const second = b[i].details;
    if (first?.length !== second?.length) return false;
    if (first?.some((detail, index) => detail.name !== second?.[index].name || detail.value !== second[index].value))
      return false;
  }

  return true;
}

export function labelRowWidth(
  entry: Pick<DebugLabelEntry, 'name' | 'value'>,
  font: FontSpec,
  measurer: TextMeasurer,
): number {
  return Math.ceil(
    horizontalAdvance(measurer, entry.name, font) +
      horizontalAdvance(measurer, entry.value, font) +
      kContentMargins +
      kNameValueGap +
      kValuePadding,
  );
}

export function labelRowLayout(
  entry: DebugLabelEntry | undefined,
  selected: boolean,
  width: number,
  baseFont: FontSpec,
  measurer: TextMeasurer,
  preserveText = false,
): DebugLabelRowLayout {
  const font: FontSpec = { ...baseFont, bold: selected };
  const contentWidth = width - kContentMargins;
  const value = entry?.value ?? '';
  const valueWidth = Math.min(
    horizontalAdvance(measurer, value, font) + kValuePadding,
    Math.max(
      0,
      contentWidth -
        (preserveText ? horizontalAdvance(measurer, entry?.name ?? '', font) : kMinimumNameWidth) -
        kNameValueGap,
    ),
  );
  const nameWidth = Math.max(0, contentWidth - valueWidth - kNameValueGap);

  return {
    id: entry?.id ?? '',
    selected,
    width,
    nameText: preserveText
      ? (entry?.name ?? '')
      : elidedText(measurer, font, entry?.name ?? '', 'ElideMiddle', nameWidth),
    nameLeft: kContentLeft,
    nameWidth,
    valueText: preserveText ? value : elidedText(measurer, font, value, 'ElideRight', valueWidth),
    valueLeft: kContentLeft + contentWidth - valueWidth,
    valueWidth,
  };
}
