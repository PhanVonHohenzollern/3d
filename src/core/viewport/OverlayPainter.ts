import type { QColor, QPen } from '../../types/painting';
import type { FontSpec, TextMeasurer } from '../../types/text';
import { cssColor, qColor, qPen } from '../../utils/painting';
import type { QRectF } from '../../utils/Rect';
import { cssFont } from '../../utils/textMetrics';
import type { QPointF } from '../../utils/Vector3D';

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

  setPen(pen: QPen | QColor | null): void {
    this.m_state.pen = pen === null ? null : 'width' in pen ? pen : qPen(pen);
  }

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
    ctx.lineWidth = pen.width > 0 ? pen.width : 1;
    ctx.lineCap = pen.cap === 'RoundCap' ? 'round' : 'square';
    ctx.lineJoin = 'bevel';
    return true;
  }

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

  drawLine(a: QPointF, b: QPointF): void {
    if (!this.applyPen()) return;
    const ctx = this.m_context;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

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
