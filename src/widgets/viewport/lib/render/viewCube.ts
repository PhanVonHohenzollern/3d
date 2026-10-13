import type { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';

export const kViewCubeSize = 144;

const faces = [
  { name: 'Right', normal: new QVector3D(1, 0, 0), u: new QVector3D(0, 1, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Left', normal: new QVector3D(-1, 0, 0), u: new QVector3D(0, -1, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Back', normal: new QVector3D(0, 1, 0), u: new QVector3D(-1, 0, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Front', normal: new QVector3D(0, -1, 0), u: new QVector3D(1, 0, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Top', normal: new QVector3D(0, 0, 1), u: new QVector3D(1, 0, 0), v: new QVector3D(0, 1, 0) },
  { name: 'Bottom', normal: new QVector3D(0, 0, -1), u: new QVector3D(1, 0, 0), v: new QVector3D(0, -1, 0) },
];

export function viewDirectionName(direction: QVector3D): string {
  return [
    direction.z > 0 ? 'Top' : direction.z < 0 ? 'Bottom' : '',
    direction.y < 0 ? 'Front' : direction.y > 0 ? 'Back' : '',
    direction.x > 0 ? 'Right' : direction.x < 0 ? 'Left' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// Each visible face has a center, four edges and four corners. All directions are
// world-space; cube projection and camera use the same orientation (world Z is up).
export function projectViewCube(orientation: Quaternion) {
  const inverse = orientation.conjugate();

  const project = (point: QVector3D) => {
    const p = inverse.rotate(point);

    return { x: 72 + p.x * 29, y: 64 - p.y * 29 };
  };

  const stops = [-1, -0.55, 0.55, 1];

  return faces
    .filter((face) => inverse.rotate(face.normal).z > 1e-6)
    .map((face) => ({
      name: face.name,
      label: project(face.normal),
      patches: Array.from({ length: 9 }, (_, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const direction = face.normal.add(face.u.mul(col - 1)).add(face.v.mul(row - 1));
        const corners = [
          [col, row],
          [col + 1, row],
          [col + 1, row + 1],
          [col, row + 1],
        ];

        return {
          direction,
          name: viewDirectionName(direction),
          points: corners
            .map(([x, y]) => {
              const p = project(face.normal.add(face.u.mul(stops[x])).add(face.v.mul(stops[y])));

              return `${p.x},${p.y}`;
            })
            .join(' '),
        };
      }),
    }));
}
