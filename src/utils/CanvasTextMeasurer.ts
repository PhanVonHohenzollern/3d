import type { FontSpec, TextMeasurer } from '../types/text';
import { cssFont } from './textMetrics';

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class CanvasTextMeasurer implements TextMeasurer {
  private readonly m_widths = new Map<string, number>();
  private readonly m_vertical = new Map<string, { ascent: number; descent: number }>();

  constructor(private readonly m_context: Context2D) {}

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
      return null;
    } catch {
      return null;
    }
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

  ascent(font: FontSpec): number {
    return this.vertical(font).ascent;
  }

  descent(font: FontSpec): number {
    return this.vertical(font).descent;
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
}
