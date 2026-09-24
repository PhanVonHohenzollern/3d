import { runtimeError } from '../../utils/cpp';
import { FdPoint3d, FdVector3d } from './FdMath';

export class FdBowlCorner {
  vertex = new FdPoint3d();
  radii = [0, 0];
  trType = 2;
  truncated = false;

  clone(): FdBowlCorner {
    const copy = new FdBowlCorner();
    Object.assign(copy, this, { radii: [...this.radii] });

    return copy;
  }
}

export class FdBowlFace {
  upVector = new FdVector3d(0, 0, 1);
  direction = new FdVector3d(0, 1, 0);
  center = new FdPoint3d();
  cover = false;
  corners: FdBowlCorner[] = [];

  constructor(count = 0) {
    this.resize(count);
  }

  resize(count: number): void {
    if (!Number.isInteger(count) || count < 0 || count > 4096) throw runtimeError('invalid bowl corner count');
    this.corners = Array.from({ length: count }, () => new FdBowlCorner());
  }

  clone(): FdBowlFace {
    const copy = new FdBowlFace();
    Object.assign(copy, this, { corners: this.corners.map((c) => c.clone()) });

    return copy;
  }

  corner(index: number): FdBowlCorner {
    if (!Number.isInteger(index) || index < 0 || index >= this.corners.length)
      throw runtimeError('bowl corner index out of range');

    return this.corners[index];
  }

  initAsRectangle(
    up: FdVector3d,
    direction: FdVector3d,
    center: FdPoint3d,
    sizes: number[],
    cover = false,
    transition = 2,
  ): void {
    if (Math.abs(up.dotProduct(direction)) > 1e-10)
      throw runtimeError('bowl up vector and direction must be perpendicular');
    if (sizes.length < 2) throw runtimeError('bowl rectangle requires two sizes');
    this.upVector = up;
    this.direction = direction.normal();
    this.center = center;
    this.cover = cover;
    this.resize(4);
    const longitudinal = this.direction.mul(sizes[1] / 2);
    const lateral = up
      .crossProduct(this.direction)
      .normal()
      .mul(sizes[0] / 2);
    this.corners.forEach((corner, i) => {
      corner.vertex = center.add(longitudinal.mul(i < 2 ? 1 : -1)).add(lateral.mul(i === 0 || i === 3 ? 1 : -1));
      corner.trType = transition;
    });
  }
}

export class FdBowlInfo {
  faces: [FdBowlFace, FdBowlFace];
  debugDrawing = false;

  constructor(
    public corners = 4,
    public complexityR = 10,
    public complexityV = 10,
  ) {
    this.faces = [new FdBowlFace(corners), new FdBowlFace(corners)];
  }

  face(index: number): FdBowlFace {
    if (index !== 0 && index !== 1) throw runtimeError('bowl face index must be 0 or 1');

    return this.faces[index];
  }

  clone(): FdBowlInfo {
    const copy = new FdBowlInfo(this.corners, this.complexityR, this.complexityV);
    copy.faces = [this.faces[0].clone(), this.faces[1].clone()];
    copy.debugDrawing = this.debugDrawing;

    return copy;
  }
}

export type BowlValue = FdBowlInfo | FdBowlFace | FdBowlCorner;

export const isBowlValue = (value: unknown): value is BowlValue =>
  value instanceof FdBowlInfo || value instanceof FdBowlFace || value instanceof FdBowlCorner;
