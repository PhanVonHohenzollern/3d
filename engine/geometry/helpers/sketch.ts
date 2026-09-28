import type { DVec3 } from '@engine/math/DVec3';
import { buildPolygonFaceMesh } from '@engine/geometry/builders/rectangularMeshes';
import { appendStroke } from '@engine/geometry/builders/strokeMeshes';
import { deg, toPoint } from '@engine/geometry/helpers/geometryMath';
import type { Frame } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

// Draws flat symbol geometry for one call: outlines as thin stroke meshes, areas as filled faces.
export class MeshSketch {
  constructor(
    readonly scene: PreviewGeometryScene,
    readonly context: MeshBuildContext,
  ) {}

  stroke(points: DVec3[], closed = false): void {
    appendStroke(this.scene, this.context, points, closed);
  }

  fill(points: DVec3[]): void {
    this.scene.meshes.push(buildPolygonFaceMesh(this.context, points.map(toPoint)));
  }
}

// A MeshSketch with local coordinates: x along the frame's right, y along its up, z along its normal.
export class FrameSketch extends MeshSketch {
  constructor(
    scene: PreviewGeometryScene,
    context: MeshBuildContext,
    readonly f: Frame,
  ) {
    super(scene, context);
  }

  at(x: number, y: number, z = 0): DVec3 {
    const { f } = this;

    return f.center.add(f.right.mul(x)).add(f.up.mul(y)).add(f.normal.mul(z));
  }

  // count + 1 points on a circle of this radius, from `begin` to `end` degrees, at height z.
  arc(radius: number, z = 0, begin = 0, end = 360, count = 64): DVec3[] {
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = deg(begin + ((end - begin) * i) / count);

      return this.at(radius * Math.cos(t), radius * Math.sin(t), z);
    });
  }
}
