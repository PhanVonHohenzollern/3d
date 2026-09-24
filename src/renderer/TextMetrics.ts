// QFont / QFontMetrics(F) equivalents for the viewport overlay and the debug
// label lists: font descriptions, text measurement and Qt's elidedText().

/**
 * Qt point sizes are converted at 96 logical DPI, the Windows/Linux value of
 * the shipped desktop builds (QFont::setPointSize(9) renders 12 px text).
 * CSS uses the same conversion, so 9 pt == 12 px.
 */
export function pointSizeToPixels(pointSize: number): number {
  return (pointSize * 96) / 72;
}

export interface FontSpec {
  family: string;
  pixelSize: number;
  bold: boolean;
}

export const kDefaultFontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** QFont with setPointSize(pointSize) / setBold(bold). */
export function fontWithPointSize(family: string, pointSize: number, bold = false): FontSpec {
  return { family, pixelSize: pointSizeToPixels(pointSize), bold };
}

/** CSS `font` shorthand for a FontSpec. */
export function cssFont(font: FontSpec): string {
  return `${font.bold ? 'bold ' : ''}${font.pixelSize}px ${font.family}`;
}

export interface TextMeasurer {
  /** QFontMetricsF::horizontalAdvance */
  horizontalAdvance(text: string, font: FontSpec): number;
  /** QFontMetricsF::ascent */
  ascent(font: FontSpec): number;
  /** QFontMetricsF::descent */
  descent(font: FontSpec): number;
}

/** QFontMetricsF::height() == ascent() + descent() */
export function fontHeightF(measurer: TextMeasurer, font: FontSpec): number {
  return measurer.ascent(font) + measurer.descent(font);
}

/** QFontMetrics::height() (integer metrics) */
export function fontHeight(measurer: TextMeasurer, font: FontSpec): number {
  return Math.round(fontHeightF(measurer, font));
}

/** QFontMetrics::horizontalAdvance() (integer metrics) */
export function horizontalAdvance(measurer: TextMeasurer, text: string, font: FontSpec): number {
  return Math.round(measurer.horizontalAdvance(text, font));
}

/** Measures with a 2D canvas context, the browser's equivalent of QFontMetricsF. */
export class CanvasTextMeasurer implements TextMeasurer {
  private readonly m_widths = new Map<string, number>();
  private readonly m_vertical = new Map<string, { ascent: number; descent: number }>();

  constructor(private readonly m_context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {}

  /** A measurer backed by a private canvas, or null outside a browser. */
  static create(): CanvasTextMeasurer | null {
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const context = new OffscreenCanvas(1, 1).getContext('2d');
        if (context) return new CanvasTextMeasurer(context);
      }
      if (typeof document !== 'undefined') {
        const context = document.createElement('canvas').getContext('2d');
        if (context) return new CanvasTextMeasurer(context);
      }
    } catch {
      // No canvas support: callers fall back to approximate metrics.
    }
    return null;
  }

  horizontalAdvance(text: string, font: FontSpec): number {
    const css = cssFont(font);
    const key = `${css}\u0000${text}`;
    const cached = this.m_widths.get(key);
    if (cached !== undefined) return cached;
    this.m_context.font = css;
    const width = this.m_context.measureText(text).width;
    if (this.m_widths.size > 20000) this.m_widths.clear();
    this.m_widths.set(key, width);
    return width;
  }

  private vertical(font: FontSpec): { ascent: number; descent: number } {
    const css = cssFont(font);
    let metrics = this.m_vertical.get(css);
    if (!metrics) {
      this.m_context.font = css;
      const m = this.m_context.measureText('Xg');
      const ascent = m.fontBoundingBoxAscent;
      const descent = m.fontBoundingBoxDescent;
      metrics =
        Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > 0
          ? { ascent, descent }
          : { ascent: font.pixelSize * 0.93, descent: font.pixelSize * 0.25 };
      this.m_vertical.set(css, metrics);
    }
    return metrics;
  }

  ascent(font: FontSpec): number {
    return this.vertical(font).ascent;
  }
  descent(font: FontSpec): number {
    return this.vertical(font).descent;
  }
}

/** Rough metrics used until a canvas measurer is available (e.g. before mount). */
export const approximateTextMeasurer: TextMeasurer = {
  horizontalAdvance: (text, font) => Array.from(text).length * font.pixelSize * 0.55,
  ascent: (font) => font.pixelSize * 0.93,
  descent: (font) => font.pixelSize * 0.25,
};

export type TextElideMode = 'ElideRight' | 'ElideMiddle';

const kEllipsis = '\u2026';

/**
 * QFontMetrics::elidedText(text, mode, width): the QTextEngine algorithm,
 * advancing one character (grapheme approximation: code point) at a time.
 */
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
  let nextLeftBreak = 0;
  let rightPos: number;
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
