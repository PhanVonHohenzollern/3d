// Ports of QRectF and QRect semantics used by renderer/Viewport3D and
// renderer/DebugLabelPanel (containment, intersection and the integer
// right()/bottom()/center() conventions of QRect).

import { QPoint, QPointF } from './Vector3D';

export class QRectF {
  constructor(readonly x = 0, readonly y = 0, readonly width = 0, readonly height = 0) {}

  /** QRectF(topLeft, size) */
  static fromTopLeft(topLeft: QPointF, width: number, height: number): QRectF {
    return new QRectF(topLeft.x, topLeft.y, width, height);
  }

  /** QRectF(const QRect &) */
  static fromRect(r: QRect): QRectF {
    return new QRectF(r.x, r.y, r.width, r.height);
  }

  left(): number { return this.x; }
  top(): number { return this.y; }
  right(): number { return this.x + this.width; }
  bottom(): number { return this.y + this.height; }
  center(): QPointF { return new QPointF(this.x + this.width / 2, this.y + this.height / 2); }

  adjusted(dx1: number, dy1: number, dx2: number, dy2: number): QRectF {
    return new QRectF(this.x + dx1, this.y + dy1, this.width + dx2 - dx1, this.height + dy2 - dy1);
  }

  private spans(): { l: number; r: number; t: number; b: number } {
    let l = this.x, r = this.x;
    if (this.width < 0) l += this.width; else r += this.width;
    let t = this.y, b = this.y;
    if (this.height < 0) t += this.height; else b += this.height;
    return { l, r, t, b };
  }

  /** QRectF::contains(const QRectF &): edges are inclusive; null rects never contain/are contained. */
  contains(other: QRectF): boolean {
    const a = this.spans();
    const o = other.spans();
    if (a.l === a.r || o.l === o.r) return false;
    if (o.l < a.l || o.r > a.r) return false;
    if (a.t === a.b || o.t === o.b) return false;
    if (o.t < a.t || o.b > a.b) return false;
    return true;
  }

  /** QRectF::intersects(): touching edges do not intersect. */
  intersects(other: QRectF): boolean {
    const a = this.spans();
    const o = other.spans();
    if (a.l === a.r || o.l === o.r) return false;
    if (a.l >= o.r || o.l >= a.r) return false;
    if (a.t === a.b || o.t === o.b) return false;
    if (a.t >= o.b || o.t >= a.b) return false;
    return true;
  }
}

/** Integer QRect: right() == x + width - 1 and bottom() == y + height - 1. */
export class QRect {
  constructor(readonly x = 0, readonly y = 0, readonly width = 0, readonly height = 0) {}

  left(): number { return this.x; }
  top(): number { return this.y; }
  right(): number { return this.x + this.width - 1; }
  bottom(): number { return this.y + this.height - 1; }
  /** QRect::center(): integer average of the inclusive edges. */
  center(): QPoint { return new QPoint(Math.trunc((this.left() + this.right()) / 2), Math.trunc((this.top() + this.bottom()) / 2)); }

  isEmpty(): boolean { return this.left() > this.right() || this.top() > this.bottom(); }

  /** QRect::contains(QPoint) for a normalized rect. */
  contains(p: QPoint): boolean {
    return p.x >= this.left() && p.x <= this.right() && p.y >= this.top() && p.y <= this.bottom();
  }

  /** QRect::intersected() for normalized rects. */
  intersected(r: QRect): QRect {
    if (this.isEmpty() || r.isEmpty()) return new QRect();
    const l = Math.max(this.left(), r.left());
    const rr = Math.min(this.right(), r.right());
    const t = Math.max(this.top(), r.top());
    const b = Math.min(this.bottom(), r.bottom());
    if (l > rr || t > b) return new QRect();
    return new QRect(l, t, rr - l + 1, b - t + 1);
  }

  translated(dx: number, dy: number): QRect {
    return new QRect(this.x + dx, this.y + dy, this.width, this.height);
  }
}
