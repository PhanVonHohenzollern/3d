import { QVector3D } from './Vector3D';

export class Bounds3D {
  private m_empty = true;
  private m_minX = 0;
  private m_minY = 0;
  private m_minZ = 0;
  private m_maxX = 0;
  private m_maxY = 0;
  private m_maxZ = 0;

  add(x: number, y: number, z: number): void {
    if (this.m_empty) {
      this.m_minX = this.m_maxX = x;
      this.m_minY = this.m_maxY = y;
      this.m_minZ = this.m_maxZ = z;
      this.m_empty = false;

      return;
    }
    this.m_minX = Math.min(this.m_minX, x);
    this.m_minY = Math.min(this.m_minY, y);
    this.m_minZ = Math.min(this.m_minZ, z);
    this.m_maxX = Math.max(this.m_maxX, x);
    this.m_maxY = Math.max(this.m_maxY, y);
    this.m_maxZ = Math.max(this.m_maxZ, z);
  }

  addPoint(p: { x: number; y: number; z: number }): void {
    this.add(p.x, p.y, p.z);
  }

  isEmpty(): boolean {
    return this.m_empty;
  }

  minimum(): QVector3D {
    return new QVector3D(this.m_minX, this.m_minY, this.m_minZ);
  }

  maximum(): QVector3D {
    return new QVector3D(this.m_maxX, this.m_maxY, this.m_maxZ);
  }
}
