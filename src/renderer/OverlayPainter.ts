// The subset of QPainter used by Viewport3D's overlay, drawn on a 2D canvas
// layered above the WebGL canvas. Coordinates are logical (CSS) pixels, like
// QPainter on a high-DPI QOpenGLWidget; antialiasing is always on, matching
// QPainter::Antialiasing | QPainter::TextAntialiasing.

import type { QRectF } from './Rect';
import { cssFont, type FontSpec, type TextMeasurer } from './TextMetrics';
import type { QPointF } from './Vector3D';

/** QColor(r, g, b[, a]) with 0..255 components. */
export interface QColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function qColor(r: number, g: number, b: number, a = 255): QColor {
  return { r, g, b, a };
}

export function cssColor(c: QColor): string {
  return c.a >= 255 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a / 255})`;
}

export const Qt = {
  white: qColor(255, 255, 255),
} as const;

export type PenCapStyle = 'SquareCap' | 'RoundCap';

/** QPen(color, width, Qt::SolidLine, cap); QPen(QColor) has width 1 and a square cap. */
export interface QPen {
  color: QColor;
  width: number;
  cap: PenCapStyle;
}

export function qPen(color: QColor, width = 1, cap: PenCapStyle = 'SquareCap'): QPen {
  return { color, width, cap };
}

interface PainterState {
  pen: QPen | null;
  brush: QColor | null;
  font: FontSpec;
}

export class OverlayPainter {
  private m_state: PainterState;
  private readonly m_stack: PainterState[] = [];

  constructor(
    private readonly m_context: CanvasRenderingContext2D,
    private readonly m_measurer: TextMeasurer,
    defaultFont: FontSpec,
  ) {
    this.m_state = { pen: qPen(qColor(0, 0, 0)), brush: null, font: defaultFont };
  }

  save(): void {
    this.m_stack.push({ ...this.m_state });
  }

  restore(): void {
    const state = this.m_stack.pop();
    if (state) this.m_state = state;
  }

  /** setPen(QPen) / setPen(QColor); null is Qt::NoPen. */
  setPen(pen: QPen | QColor | null): void {
    this.m_state.pen = pen === null ? null : 'width' in pen ? pen : qPen(pen);
  }

  /** setBrush(QColor); null is Qt::NoBrush. */
  setBrush(brush: QColor | null): void {
    this.m_state.brush = brush;
  }

  setFont(font: FontSpec): void {
    this.m_state.font = font;
  }

  font(): FontSpec {
    return this.m_state.font;
  }

  private applyPen(): boolean {
    const pen = this.m_state.pen;
    if (!pen) return false;
    const ctx = this.m_context;
    ctx.strokeStyle = cssColor(pen.color);
    // A zero-width QPen is a cosmetic one-pixel pen.
    ctx.lineWidth = pen.width > 0 ? pen.width : 1;
    ctx.lineCap = pen.cap === 'RoundCap' ? 'round' : 'square';
    ctx.lineJoin = 'bevel';
    return true;
  }

  /** drawEllipse(center, rx, ry) */
  drawEllipse(center: QPointF, rx: number, ry: number): void {
    const ctx = this.m_context;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    if (this.m_state.brush) {
      ctx.fillStyle = cssColor(this.m_state.brush);
      ctx.fill();
    }
    if (this.applyPen()) ctx.stroke();
  }

  /** drawLine(p1, p2) */
  drawLine(a: QPointF, b: QPointF): void {
    if (!this.applyPen()) return;
    const ctx = this.m_context;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /** drawRoundedRect(rect, xRadius, yRadius) with absolute radii. */
  drawRoundedRect(rect: QRectF, xRadius: number, yRadius: number): void {
    const ctx = this.m_context;
    const rx = Math.min(xRadius, rect.width / 2);
    const ry = Math.min(yRadius, rect.height / 2);
    const x = rect.x,
      y = rect.y,
      w = rect.width,
      h = rect.height;
    ctx.beginPath();
    ctx.moveTo(x + rx, y);
    ctx.lineTo(x + w - rx, y);
    ctx.ellipse(x + w - rx, y + ry, rx, ry, 0, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - ry);
    ctx.ellipse(x + w - rx, y + h - ry, rx, ry, 0, 0, Math.PI / 2);
    ctx.lineTo(x + rx, y + h);
    ctx.ellipse(x + rx, y + h - ry, rx, ry, 0, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + ry);
    ctx.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    if (this.m_state.brush) {
      ctx.fillStyle = cssColor(this.m_state.brush);
      ctx.fill();
    }
    if (this.applyPen()) ctx.stroke();
  }

  /**
   * drawText(rect, Qt::AlignCenter, text) for a single line: the text is
   * centered horizontally by its advance and vertically by ascent + descent,
   * as QPainter lays it out. Text uses the pen color.
   */
  drawTextCentered(rect: QRectF, text: string): void {
    const pen = this.m_state.pen;
    if (!pen) return;
    const ctx = this.m_context;
    const font = this.m_state.font;
    const advance = this.m_measurer.horizontalAdvance(text, font);
    const ascent = this.m_measurer.ascent(font);
    const descent = this.m_measurer.descent(font);
    ctx.font = cssFont(font);
    ctx.fillStyle = cssColor(pen.color);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const x = rect.x + (rect.width - advance) / 2;
    const baseline = rect.y + (rect.height - (ascent + descent)) / 2 + ascent;
    ctx.fillText(text, x, baseline);
  }
}
