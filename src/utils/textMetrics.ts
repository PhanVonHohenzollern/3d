import type { FontSpec, TextElideMode, TextMeasurer } from '../types/text';

export const kDefaultFontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const kEllipsis = '…';

export function pointSizeToPixels(pointSize: number): number {
  return (pointSize * 96) / 72;
}

export function fontWithPointSize(family: string, pointSize: number, bold = false): FontSpec {
  return { family, pixelSize: pointSizeToPixels(pointSize), bold };
}

export function cssFont(font: FontSpec): string {
  return `${font.bold ? 'bold ' : ''}${font.pixelSize}px ${font.family}`;
}

export function fontHeightF(measurer: TextMeasurer, font: FontSpec): number {
  return measurer.ascent(font) + measurer.descent(font);
}

export function fontHeight(measurer: TextMeasurer, font: FontSpec): number {
  return Math.round(fontHeightF(measurer, font));
}

export function horizontalAdvance(measurer: TextMeasurer, text: string, font: FontSpec): number {
  return Math.round(measurer.horizontalAdvance(text, font));
}

export const approximateTextMeasurer: TextMeasurer = {
  horizontalAdvance: (text, font) => Array.from(text).length * font.pixelSize * 0.55,
  ascent: (font) => font.pixelSize * 0.93,
  descent: (font) => font.pixelSize * 0.25,
};

export function elidedText(
  measurer: TextMeasurer,
  font: FontSpec,
  text: string,
  mode: TextElideMode,
  width: number,
): string {
  const chars = Array.from(text);
  const to = chars.length;
  if (measurer.horizontalAdvance(text, font) <= width || to <= 1) return text;

  const availableWidth = width - measurer.horizontalAdvance(kEllipsis, font);
  if (availableWidth < 0) return '';

  const charWidth = (i: number) => measurer.horizontalAdvance(chars[i], font);

  if (mode === 'ElideRight') {
    let currentWidth = 0;
    let pos: number;
    let nextBreak = 0;
    do {
      pos = nextBreak;
      ++nextBreak;
      currentWidth += charWidth(pos);
    } while (nextBreak < to && currentWidth < availableWidth);

    return chars.slice(0, pos).join('') + kEllipsis;
  }

  let leftWidth = 0;
  let rightWidth = 0;
  let leftPos: number;
  let rightPos: number;
  let nextLeftBreak = 0;
  let nextRightBreak = to;
  do {
    leftPos = nextLeftBreak;
    rightPos = nextRightBreak;
    ++nextLeftBreak;
    --nextRightBreak;
    leftWidth += charWidth(leftPos);
    rightWidth += charWidth(nextRightBreak);
  } while (nextLeftBreak < to && nextRightBreak > 0 && leftWidth + rightWidth < availableWidth);

  return chars.slice(0, leftPos).join('') + kEllipsis + chars.slice(rightPos).join('');
}
