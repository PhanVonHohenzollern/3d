import { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';

export const kViewCubeSize = 112;
const center = 80;

function circlePoint(radius: number, angle: number): string {
  const radians = (angle * Math.PI) / 180;

  return `${center + radius * Math.sin(radians)},${center - radius * Math.cos(radians)}`;
}

// Angles run clockwise from twelve o'clock. Separate paths leave real gaps
// between the eight buttons, as in the circular navigator reference.
export function navigationArc(inner: number, outer: number, start: number, end: number): string {
  const largeArc = end - start > 180 ? 1 : 0;

  return `M${circlePoint(outer, start)} A${outer},${outer} 0 ${largeArc} 1 ${circlePoint(outer, end)} L${circlePoint(inner, end)} A${inner},${inner} 0 ${largeArc} 0 ${circlePoint(inner, start)} Z`;
}

const ringViews = [
  { name: 'Back', direction: new QVector3D(0, 1, 0) },
  { name: 'NE Isometric', direction: new QVector3D(1, 1, 1) },
  { name: 'Right', direction: new QVector3D(1, 0, 0) },
  { name: 'SE Isometric', direction: new QVector3D(1, -1, 1) },
  { name: 'Front', direction: new QVector3D(0, -1, 0) },
  { name: 'SW Isometric', direction: new QVector3D(-1, -1, 1) },
  { name: 'Left', direction: new QVector3D(-1, 0, 0) },
  { name: 'NW Isometric', direction: new QVector3D(-1, 1, 1) },
].map((view, index) => ({ ...view, path: navigationArc(46, 76, index * 45 - 21, index * 45 + 21) }));

export const navigationViews = [
  ...ringViews,
  { name: 'Top', direction: new QVector3D(0, 0, 1), path: navigationArc(28, 43, -88, 88) },
  { name: 'Bottom', direction: new QVector3D(0, 0, -1), path: navigationArc(28, 43, 92, 268) },
].map((view) => ({ ...view, orientation: Quaternion.lookingFrom(view.direction) }));

export function activeNavigationView(orientation: Quaternion): string | null {
  // Compare full orientations, including roll; opposite quaternion signs describe
  // the same view. Orbit clears the selection, while Pan and Zoom preserve it.
  return (
    navigationViews.find(({ orientation: preset }) => {
      const dot =
        orientation.x * preset.x + orientation.y * preset.y + orientation.z * preset.z + orientation.w * preset.w;

      return Math.abs(dot) > 1 - 1e-8;
    })?.name ?? null
  );
}

const faces = [
  { name: 'Right', normal: new QVector3D(1, 0, 0), u: new QVector3D(0, 1, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Left', normal: new QVector3D(-1, 0, 0), u: new QVector3D(0, -1, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Back', normal: new QVector3D(0, 1, 0), u: new QVector3D(-1, 0, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Front', normal: new QVector3D(0, -1, 0), u: new QVector3D(1, 0, 0), v: new QVector3D(0, 0, 1) },
  { name: 'Top', normal: new QVector3D(0, 0, 1), u: new QVector3D(1, 0, 0), v: new QVector3D(0, 1, 0) },
  { name: 'Bottom', normal: new QVector3D(0, 0, -1), u: new QVector3D(1, 0, 0), v: new QVector3D(0, -1, 0) },
];

// The small center cube indicates orientation; navigation uses the surrounding rings.
export function projectViewCube(orientation: Quaternion) {
  const inverse = orientation.conjugate();

  const project = (point: QVector3D) => {
    const p = inverse.rotate(point);

    return { x: center + p.x * 9, y: center - p.y * 9 };
  };

  return faces
    .filter((face) => inverse.rotate(face.normal).z > 1e-6)
    .map((face) => ({
      name: face.name,
      color: face.normal.z !== 0 ? '#666666' : face.normal.x !== 0 ? '#353535' : '#202020',
      points: [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]
        .map(([x, y]) => {
          const p = project(face.normal.add(face.u.mul(x)).add(face.v.mul(y)));

          return `${p.x},${p.y}`;
        })
        .join(' '),
    }));
}
