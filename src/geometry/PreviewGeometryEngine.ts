// Port of geometry/PreviewGeometryEngine.{h,cpp}.
//
// The structure follows the C++ file so both can be diffed side by side:
// everything except the scene types and PreviewGeometryEngine.build() is
// module-private (the C++ anonymous namespace).
//
// Porting conventions:
// - DVec3 arithmetic keeps the C++ operator order (`a + b*s + c` is written
//   `a.add(b.mul(s)).add(c)`), so results are bit-identical doubles.
// - C++ `float` storage (PreviewMeshVertex, PreviewColor) is Math.fround()ed
//   exactly where the C++ converts a double to float.
// - C++ scalar out-parameters (`FdPoint3d &out`) are Ref<T> objects. As in the
//   C++, a converter writes `out.v` only when it succeeds. Vector out-parameters
//   (`std::vector<T> &out`) are arrays filled in place. stableBasis/basisFromUp
//   return their two DVec3 out-parameters as a tuple.
// - std::min/std::max/std::clamp/std::llround/std::sort/std::unique have small
//   helpers below that reproduce the C++ results (including NaN handling).

import { apiSignatureMetadataForCall, type ApiParameterMetadata, type ApiSignatureMetadata } from '../runtime/ApiMetadata';
import { stod, stoll } from '../runtime/CppCompat';
import { FdPoint3d, FdVector3d } from '../runtime/FdMath';
import type { RuntimeApiCall, RuntimeResult } from '../runtime/RuntimeTypes';
import { RuntimeArray, runtimeDeepCopy, runtimeDefaultValueForType, type RuntimeValue } from '../runtime/RuntimeValue';

// ---------------------------------------------------------------------------
// Public scene types (PreviewGeometryEngine.h)

/** C++ floats: every component holds a Math.fround()ed value. */
export interface PreviewColor {
  r: number;
  g: number;
  b: number;
}

/** Default mesh color: golden orange (255, 176, 0). */
export function defaultPreviewColor(): PreviewColor {
  return { r: 1.0, g: Math.fround(176.0 / 255.0), b: 0.0 };
}

/** C++ floats: every component holds a Math.fround()ed value. */
export interface PreviewMeshVertex {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface PreviewMesh {
  /** zero-based index in RuntimeResult.apiCalls */
  apiIndex: number;
  sourceLine: number;
  /** original SDK call name, optionally followed by a part suffix */
  apiName: string;
  color: PreviewColor;
  vertices: PreviewMeshVertex[];
  /** uint32 */
  indices: number[];
}

export interface PreviewGeometryScene {
  meshes: PreviewMesh[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// namespace {

const kPi = 3.1415926535897932384626433832795;
const kEps = 1e-9;

const f32 = Math.fround;

// C++ standard-library helpers with the exact C++ results.
/** std::min(a, b) */
const stdMin = (a: number, b: number): number => (b < a ? b : a);
/** std::max(a, b) */
const stdMax = (a: number, b: number): number => (a < b ? b : a);
/** std::clamp(v, lo, hi) */
const stdClamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : hi < v ? hi : v);
/**
 * static_cast<int>(std::llround(d)): rounds half away from zero, then keeps the
 * low 32 bits. NaN and results outside int64 give INT64_MIN as on the x86-64
 * desktop builds (cvttsd2si), i.e. 0 after the int cast.
 */
function llroundToInt(d: number): number {
  if (!(Math.abs(d) < 9223372036854775808)) return 0;
  let r = Math.trunc(d);
  if (Math.abs(d - r) >= 0.5) r += d < 0 ? -1 : 1;
  return r | 0;
}
// std::sort of the two 4-element ranges below. For a strict weak ordering every
// std::sort gives the same result here (equal keys cannot be told apart, or
// keep their order). With NaN keys std::sort is undefined; these follow the
// libc++ algorithms of the reference build so even such input matches it.
/** libc++ std::sort of 4 elements with a custom comparator (__sort4). */
function stdSort4<T>(v: T[], c: (a: T, b: T) => boolean): void {
  const swap = (i: number, j: number) => { const t = v[i]; v[i] = v[j]; v[j] = t; };
  // __sort3(x1, x2, x3)
  if (!c(v[1], v[0])) {
    if (c(v[2], v[1])) {
      swap(1, 2);
      if (c(v[1], v[0])) swap(0, 1);
    }
  } else if (c(v[2], v[1])) {
    swap(0, 2);
  } else {
    swap(0, 1);
    if (c(v[2], v[1])) swap(1, 2);
  }
  // insert x4
  if (c(v[3], v[2])) {
    swap(2, 3);
    if (c(v[2], v[1])) {
      swap(1, 2);
      if (c(v[1], v[0])) swap(0, 1);
    }
  }
}
/** libc++ std::sort of 4 doubles (branchless __sort4 network). */
function stdSort4Doubles(v: number[]): void {
  const condSwap = (x: number, y: number) => {
    const r = v[x] < v[y];
    const tmp = r ? v[x] : v[y];
    v[y] = r ? v[y] : v[x];
    v[x] = tmp;
  };
  condSwap(0, 2);
  condSwap(1, 3);
  condSwap(0, 1);
  condSwap(2, 3);
  condSwap(1, 2);
}
/** v.erase(std::unique(v.begin(), v.end()), v.end()) */
function eraseUnique(values: number[]): void {
  let result = 0;
  for (let i = 1; i < values.length; ++i) {
    if (!(values[result] === values[i])) values[++result] = values[i];
  }
  if (values.length) values.length = result + 1;
}

/** A C++ out-parameter (`T &out`). */
interface Ref<T> {
  v: T;
}
const ref = <T>(v: T): Ref<T> => ({ v });

// A mesh belongs to the original runtime API call, even when builders are reused.
// SDK signatures and defaults remain in runtime/ApiMetadata.generated.inc.
class MeshBuildContext {
  constructor(
    readonly call: RuntimeApiCall,
    readonly apiIndex: number,
    readonly color: PreviewColor,
  ) {}

  createMesh(part = ''): PreviewMesh {
    return {
      apiIndex: this.apiIndex,
      sourceLine: this.call.line,
      apiName: this.call.name + part,
      color: { r: this.color.r, g: this.color.g, b: this.color.b },
      vertices: [],
      indices: [],
    };
  }
}

class DVec3 {
  constructor(
    readonly x = 0.0,
    readonly y = 0.0,
    readonly z = 0.0,
  ) {}

  /** operator+ */
  add(b: DVec3): DVec3 { return new DVec3(this.x + b.x, this.y + b.y, this.z + b.z); }
  /** operator- */
  sub(b: DVec3): DVec3 { return new DVec3(this.x - b.x, this.y - b.y, this.z - b.z); }
  /** operator*(double) */
  mul(s: number): DVec3 { return new DVec3(this.x * s, this.y * s, this.z * s); }
  /** operator/(double) */
  div(s: number): DVec3 { return new DVec3(this.x / s, this.y / s, this.z / s); }
}

/** double m[4][4] */
type DMat4 = number[][];

function zeroMatrix(): DMat4 {
  return [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
}

function identityMatrix(): DMat4 {
  const r = zeroMatrix();
  for (let i = 0; i < 4; ++i) r[i][i] = 1.0;
  return r;
}

function multiply(a: DMat4, b: DMat4): DMat4 {
  const r = zeroMatrix();
  for (let row = 0; row < 4; ++row)
    for (let col = 0; col < 4; ++col)
      for (let k = 0; k < 4; ++k) r[row][col] += a[row][k] * b[k][col];
  return r;
}

function translationMatrix(v: FdVector3d): DMat4 {
  const r = identityMatrix();
  r[0][3] = v.x; r[1][3] = v.y; r[2][3] = v.z;
  return r;
}

function rotationMatrix(angle: number, axisInput: FdVector3d): DMat4 {
  const len = Math.sqrt(axisInput.x * axisInput.x + axisInput.y * axisInput.y + axisInput.z * axisInput.z);
  if (len <= 1e-12) return identityMatrix();
  const x = axisInput.x / len, y = axisInput.y / len, z = axisInput.z / len;
  const c = Math.cos(angle), si = Math.sin(angle), t = 1.0 - c;
  const r = identityMatrix();
  r[0][0] = t * x * x + c;     r[0][1] = t * x * y - si * z; r[0][2] = t * x * z + si * y;
  r[1][0] = t * x * y + si * z; r[1][1] = t * y * y + c;     r[1][2] = t * y * z - si * x;
  r[2][0] = t * x * z - si * y; r[2][1] = t * y * z + si * x; r[2][2] = t * z * z + c;
  return r;
}

function transformPoint(m: DMat4, p: DVec3): DVec3 {
  return new DVec3(
    m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z + m[0][3],
    m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z + m[1][3],
    m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z + m[2][3]);
}

function transformDirection(m: DMat4, v: DVec3): DVec3 {
  return new DVec3(
    m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z);
}

function dot(a: DVec3, b: DVec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: DVec3, b: DVec3): DVec3 {
  return new DVec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
function length(v: DVec3): number { return Math.sqrt(dot(v, v)); }
function normalized(v: DVec3): DVec3 {
  const len = length(v);
  if (len <= 1e-12) return new DVec3();
  return v.div(len);
}

/** toVec(const FdPoint3d &) / toVec(const FdVector3d &) */
function toVec(p: FdPoint3d | FdVector3d): DVec3 { return new DVec3(p.x, p.y, p.z); }

function vertex(p: DVec3, n: DVec3): PreviewMeshVertex {
  return {
    x: f32(p.x), y: f32(p.y), z: f32(p.z),
    nx: f32(n.x), ny: f32(n.y), nz: f32(n.z),
  };
}

function applyTransform(mesh: PreviewMesh, matrix: DMat4): void {
  for (const v of mesh.vertices) {
    const p = transformPoint(matrix, new DVec3(v.x, v.y, v.z));
    const n = transformDirection(matrix, new DVec3(v.nx, v.ny, v.nz));
    let nx = n.x, ny = n.y, nz = n.z;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-12) { nx /= len; ny /= len; nz /= len; }
    v.x = f32(p.x); v.y = f32(p.y); v.z = f32(p.z);
    v.nx = f32(nx); v.ny = f32(ny); v.nz = f32(nz);
  }
}

function asPoint(value: RuntimeValue, out: Ref<FdPoint3d>): boolean {
  if (value instanceof FdPoint3d) { out.v = value; return true; }
  return false;
}

function asVector(value: RuntimeValue, out: Ref<FdVector3d>): boolean {
  if (value instanceof FdVector3d) { out.v = value; return true; }
  return false;
}

function asNumber(value: RuntimeValue, out: Ref<number>): boolean {
  if (typeof value === 'number') { out.v = value; return true; }
  if (typeof value === 'bigint') { out.v = Number(value); return true; }
  if (typeof value === 'boolean') { out.v = value ? 1.0 : 0.0; return true; }
  return false;
}

function asInt(value: RuntimeValue, out: Ref<number>): boolean {
  const d = ref(0.0);
  if (!asNumber(value, d)) return false;
  out.v = llroundToInt(d.v);
  return true;
}

function asBool(value: RuntimeValue, out: Ref<boolean>): boolean {
  if (typeof value === 'boolean') { out.v = value; return true; }
  const n = ref(0.0);
  if (asNumber(value, n)) { out.v = n.v !== 0.0; return true; }
  return false;
}

function asArray(value: RuntimeValue): RuntimeArray | null {
  return value instanceof RuntimeArray ? value : null;
}

function pointArray(value: RuntimeValue, out: FdPoint3d[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const p = ref(new FdPoint3d());
    if (!asPoint(element, p)) return false;
    out.push(p.v);
  }
  return true;
}

function vectorArray(value: RuntimeValue, out: FdVector3d[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const v = ref(new FdVector3d());
    if (!asVector(element, v)) return false;
    out.push(v.v);
  }
  return true;
}

function numberArray(value: RuntimeValue, out: number[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const n = ref(0.0);
    if (!asNumber(element, n)) return false;
    out.push(n.v);
  }
  return true;
}

function boolArray(value: RuntimeValue, out: boolean[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const b = ref(false);
    if (!asBool(element, b)) return false;
    out.push(b.v);
  }
  return true;
}

function numberMatrix(value: RuntimeValue, out: number[][]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const rowValue of a.elements) {
    const row: number[] = [];
    if (!numberArray(rowValue, row)) return false;
    out.push(row);
  }
  return true;
}

function intArray(value: RuntimeValue, out: number[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const n = ref(0);
    if (!asInt(element, n)) return false;
    out.push(n.v);
  }
  return true;
}

function rotateAroundAxis(v: DVec3, axisInput: DVec3, angle: number): DVec3 {
  const axis = normalized(axisInput);
  if (length(axis) <= kEps) return v;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return v.mul(c).add(cross(axis, v).mul(s)).add(axis.mul(dot(axis, v) * (1.0 - c)));
}

function toPoint(v: DVec3): FdPoint3d { return new FdPoint3d(v.x, v.y, v.z); }
function toFdVector(v: DVec3): FdVector3d { return new FdVector3d(v.x, v.y, v.z); }

function twoPointsFromArray(value: RuntimeValue, a: Ref<FdPoint3d>, b: Ref<FdPoint3d>): boolean {
  const points: FdPoint3d[] = [];
  if (!pointArray(value, points) || points.length < 2) return false;
  a.v = points[0];
  b.v = points[1];
  return true;
}

function colorComponent(v: number): number {
  return f32(stdClamp(v / 255.0, 0.0, 1.0));
}

function acadIndexColor(index: number): PreviewColor {
  switch (index) {
    case 1: return { r: 1.0, g: 0.0, b: 0.0 };
    case 2: return { r: 1.0, g: 1.0, b: 0.0 };
    case 3: return { r: 0.0, g: 1.0, b: 0.0 };
    case 4: return { r: 0.0, g: 1.0, b: 1.0 };
    case 5: return { r: 0.0, g: 0.0, b: 1.0 };
    case 6: return { r: 1.0, g: 0.0, b: 1.0 };
    case 7: return { r: 1.0, g: 1.0, b: 1.0 };
    default: {
      const gray = f32(stdClamp(index, 0, 255) / 255.0);
      return { r: gray, g: gray, b: gray };
    }
  }
}

function warningFor(call: RuntimeApiCall, reason: string): string {
  return `line ${call.line} ${call.name}: ${reason}`;
}

/** C++ `void stableBasis(const DVec3 &normal, DVec3 &u, DVec3 &v)`; returns [u, v]. */
function stableBasis(normal: DVec3): [DVec3, DVec3] {
  const n = normalized(normal);
  const helper = Math.abs(n.z) < 0.85 ? new DVec3(0, 0, 1) : new DVec3(0, 1, 0);
  let u = normalized(cross(n, helper));
  if (length(u) <= 1e-12) u = normalized(cross(n, new DVec3(1, 0, 0)));
  const v = normalized(cross(n, u));
  return [u, v];
}

/** C++ `void basisFromUp(const DVec3 &axis, const DVec3 &upHint, DVec3 &u, DVec3 &v)`; returns [u, v]. */
function basisFromUp(axis: DVec3, upHint: DVec3): [DVec3, DVec3] {
  // SDK semantics: axis/normal determines the section plane, while upHint
  // only determines the orientation inside that plane.  Never treat a
  // direction vector as a position.
  const n = normalized(axis);
  const projected = upHint.sub(n.mul(dot(upHint, n)));
  if (length(projected) <= 1e-12) {
    return stableBasis(n);
  }
  const u = normalized(projected);
  const v = normalized(cross(n, u));
  return [u, v];
}

function circularFaceCount(complexity: number): number {
  // Circular primitives in the supplied SDK documentation multiply n by
  // four internally.  n=1 is therefore a diamond, n=10 gives 40 faces.
  const faces = stdMax(1, complexity) * 4;
  return stdClamp(faces, 4, 4096);
}

function sdkPerpVector(direction: FdVector3d): FdVector3d {
  const [u] = stableBasis(toVec(direction));
  return toFdVector(u);
}

function addTriangle(mesh: PreviewMesh, a: number, b: number, c: number): void {
  // std::uint32_t indices
  mesh.indices.push(a >>> 0);
  mesh.indices.push(b >>> 0);
  mesh.indices.push(c >>> 0);
}

function buildConnectorSleeveMesh(
  context: MeshBuildContext, center: FdPoint3d, normal: FdVector3d,
  upVector: FdVector3d, width: number, height: number, connectorLength: number,
  sideCode: number, directionSign: number): PreviewMesh {
  const mesh = context.createMesh();
  if (sideCode === 5 || width <= 0.0 || height <= 0.0 || connectorLength <= 0.0)
    return mesh;

  // A connector is positioned by its central point.  normal and upVector only
  // define the local frame.  connectorLength moves the connector end along
  // the normal, matching the SDK description that the connector ends a given
  // distance from the box.
  const n = normalized(toVec(normal));
  if (length(n) <= kEps) return mesh;
  const [up, right] = basisFromUp(n, toVec(upVector));
  const c0 = toVec(center);
  const c1 = c0.add(n.mul(Math.abs(connectorLength) * (directionSign < 0.0 ? -1.0 : 1.0)));
  const hw = Math.abs(width) * 0.5;
  const hh = Math.abs(height) * 0.5;

  const appendSection = (c: DVec3) => {
    mesh.vertices.push(vertex(c.add(right.mul(hw)).add(up.mul(hh)), n));
    mesh.vertices.push(vertex(c.sub(right.mul(hw)).add(up.mul(hh)), n));
    mesh.vertices.push(vertex(c.sub(right.mul(hw)).sub(up.mul(hh)), n));
    mesh.vertices.push(vertex(c.add(right.mul(hw)).sub(up.mul(hh)), n));
  };
  appendSection(c0);
  appendSection(c1);

  const visible = (side: number): boolean => {
    if (sideCode === 0) return true;
    if (sideCode >= 1 && sideCode <= 4) return side === sideCode - 1;
    if (sideCode === 24) return side === 1 || side === 3;
    if (sideCode === 13) return side === 0 || side === 2;
    return false;
  };
  for (let side = 0; side < 4; ++side) {
    if (!visible(side)) continue;
    const next = (side + 1) % 4;
    const a = side;
    const b = next;
    const c = 4 + next;
    const d = 4 + side;
    addTriangle(mesh, a, b, c);
    addTriangle(mesh, a, c, d);
  }
  return mesh;
}


function buildRectToEllipseTransitionMesh(
  context: MeshBuildContext, rectCorners: FdPoint3d[],
  rectCenter: FdPoint3d,
  normal: FdVector3d,
  upVector: FdVector3d,
  tubeStart: FdPoint3d,
  diamA: number, diamB: number, complexity: number): PreviewMesh {
  const mesh = context.createMesh();

  const n = normalized(toVec(normal));
  if (length(n) <= kEps || diamA <= 0.0 || diamB <= 0.0 || complexity < 1
    || rectCorners.length < 4)
    return mesh;

  const [up, side] = basisFromUp(n, toVec(upVector));
  const ringSegments = circularFaceCount(complexity);
  const tubeC = toVec(tubeStart);
  const rectC = toVec(rectCenter);

  interface P2 { x: number; y: number }
  const polygon: P2[] = [];
  for (let i = 0; i < 4; ++i) {
    const delta = toVec(rectCorners[i]).sub(rectC);
    polygon.push({ x: dot(delta, up), y: dot(delta, side) });
  }

  // Guarantee a cyclic order even if the caller supplied the four corners in
  // a different starting order.  The rectangle center is the API position;
  // vectors only define this 2-D frame.
  stdSort4(polygon, (a, b) => Math.atan2(a.y, a.x) < Math.atan2(b.y, b.x));

  const rayToRectangle = (angle: number): DVec3 => {
    const d: P2 = { x: Math.cos(angle), y: Math.sin(angle) };
    let bestT = 1e100;
    for (let e = 0; e < polygon.length; ++e) {
      const a = polygon[e];
      const b = polygon[(e + 1) % polygon.length];
      const edge: P2 = { x: b.x - a.x, y: b.y - a.y };
      const det = d.x * (-edge.y) - d.y * (-edge.x);
      if (Math.abs(det) <= 1e-12) continue;
      // Solve t*d = a + u*edge.
      const t = (a.x * (-edge.y) - a.y * (-edge.x)) / det;
      const u = (d.x * a.y - d.y * a.x) / det;
      if (t >= -1e-9 && u >= -1e-9 && u <= 1.0 + 1e-9)
        bestT = stdMin(bestT, stdMax(0.0, t));
    }
    if (!Number.isFinite(bestT) || bestT >= 1e99) return rectC;
    return rectC.add(up.mul(d.x * bestT)).add(side.mul(d.y * bestT));
  };

  const rA = 0.5 * Math.abs(diamA);
  const rB = 0.5 * Math.abs(diamB);

  for (let i = 0; i < ringSegments; ++i) {
    const angle = 2.0 * kPi * i / ringSegments;
    const rectanglePoint = rayToRectangle(angle);
    const ellipseOffset = up.mul(rA * Math.cos(angle)).add(side.mul(rB * Math.sin(angle)));
    const ellipsePoint = tubeC.add(ellipseOffset);
    // Smooth-enough preview normal for the loft wall.  Position is derived
    // only from point inputs; normal/upVector merely orient the frame.
    let wallNormal = normalized(rectanglePoint.sub(rectC).add(ellipsePoint.sub(tubeC)));
    if (length(wallNormal) <= kEps) wallNormal = normalized(ellipseOffset);
    mesh.vertices.push(vertex(rectanglePoint, wallNormal));
    mesh.vertices.push(vertex(ellipsePoint, wallNormal));
  }

  for (let i = 0; i < ringSegments; ++i) {
    const j = (i + 1) % ringSegments;
    const r0 = 2 * i;
    const e0 = r0 + 1;
    const r1 = 2 * j;
    const e1 = r1 + 1;
    addTriangle(mesh, r0, r1, e1);
    addTriangle(mesh, r0, e1, e0);
  }
  return mesh;
}

function rectangleCorners(
  center: FdPoint3d, normal: FdVector3d,
  upVector: FdVector3d, height: number, width: number): FdPoint3d[] {
  const n = normalized(toVec(normal));
  const [up, side] = basisFromUp(n, toVec(upVector));
  const c = toVec(center);
  const hh = 0.5 * Math.abs(height);
  const hw = 0.5 * Math.abs(width);
  // Order follows the perimeter around the section when looking down normal.
  return [
    toPoint(c.add(up.mul(hh)).add(side.mul(hw))),
    toPoint(c.sub(up.mul(hh)).add(side.mul(hw))),
    toPoint(c.sub(up.mul(hh)).sub(side.mul(hw))),
    toPoint(c.add(up.mul(hh)).sub(side.mul(hw))),
  ];
}


/** Returns the C++ std::pair<PreviewMesh, PreviewMesh>{tube, duct}. */
function buildRectTubeIntersectionMeshes(
  context: MeshBuildContext, start: FdPoint3d,
  normal: FdVector3d, upVector: FdVector3d,
  diamA: number, diamB: number, tubeLength: number,
  offsetLR: number, offsetUD: number,
  ductWidth: number, ductHeight: number, ductLength: number, complexity: number): [PreviewMesh, PreviewMesh] {
  const meshes: [PreviewMesh, PreviewMesh] = [context.createMesh('.main'), context.createMesh('.duct')];
  const [tube, duct] = meshes;

  const axis = normalized(toVec(normal));
  const [up, side] = basisFromUp(axis, toVec(upVector));
  const p0 = toVec(start);
  const a = diamA * 0.5, b = diamB * 0.5;
  const sign = ductLength < 0.0 ? -1.0 : 1.0;
  const outer = Math.abs(ductLength);
  const hole0 = stdClamp(offsetLR - ductWidth * 0.5, 0.0, tubeLength);
  const hole1 = stdClamp(offsetLR + ductWidth * 0.5, 0.0, tubeLength);
  const upMin = stdClamp(offsetUD - ductHeight * 0.5, -a, a);
  const upMax = stdClamp(offsetUD + ductHeight * 0.5, -a, a);
  const segs = circularFaceCount(complexity);

  interface Profile { u: number; s: number }
  const ring: Profile[] = [];
  // Intersect the actual faceted ellipse with both rectangular sides. Split
  // the existing facets rather than rounding the hole to nearby angular cells
  // or changing a low-complexity polygon into a different curved surface.
  for (let i = 0; i < segs; ++i) {
    const angle = 2.0 * kPi * i / segs, nextAngle = 2.0 * kPi * (i + 1) / segs;
    const current: Profile = { u: a * Math.cos(angle), s: b * Math.sin(angle) };
    const next: Profile = { u: a * Math.cos(nextAngle), s: b * Math.sin(nextAngle) };
    ring.push(current);
    if (i >= Math.trunc(segs / 2)) continue;
    for (const u of [upMax, upMin]) {
      if (u >= current.u - kEps || u <= next.u + kEps) continue;
      const t = (u - current.u) / (next.u - current.u);
      ring.push({ u, s: current.s + t * (next.s - current.s) });
    }
  }
  const boundaryIndex = (u: number): number => {
    let closest = 0;
    let distance = 1e100;
    for (let i = 0; i < ring.length; ++i) {
      if (ring[i].s < -kEps) continue;
      const delta = Math.abs(ring[i].u - u);
      if (delta < distance) { closest = i; distance = delta; }
    }
    return closest;
  };
  const first = boundaryIndex(upMax), last = boundaryIndex(upMin);
  // Both meshes use these exact positions, including the curved seam at
  // either axial side of the duct. A flat start section cannot meet the tube.
  const point = (x: number, i: number, atOuter = false): DVec3 =>
    p0.add(axis.mul(x)).add(up.mul(ring[i].u)).add(side.mul(sign * (atOuter ? outer : ring[i].s)));
  const stations = [0.0, hole0, hole1, tubeLength];
  stdSort4Doubles(stations);
  eraseUnique(stations);
  for (const x of stations) {
    for (let i = 0; i < ring.length; ++i) {
      const r = ring[i];
      const radialNormal = normalized(up.mul(r.u / (a * a)).add(side.mul(sign * r.s / (b * b))));
      tube.vertices.push(vertex(point(x, i), radialNormal));
    }
  }
  for (let r = 0; r + 1 < stations.length; ++r) {
    const axialHole = stations[r] >= hole0 && stations[r + 1] <= hole1;
    for (let i = 0; i < ring.length; ++i) {
      if (axialHole && i >= first && i < last) continue;
      const j = (i + 1) % ring.length;
      const a0 = r * ring.length + i;
      const b0 = r * ring.length + j;
      const c0 = (r + 1) * ring.length + j;
      const d0 = (r + 1) * ring.length + i;
      if (sign > 0) { addTriangle(tube, a0, b0, c0); addTriangle(tube, a0, c0, d0); }
      else { addTriangle(tube, a0, c0, b0); addTriangle(tube, a0, d0, c0); }
    }
  }
  const wall = (a0: DVec3, b0: DVec3, c0: DVec3, d0: DVec3, n: DVec3) => {
    const index = duct.vertices.length;
    for (const p of [a0, b0, c0, d0]) duct.vertices.push(vertex(p, n));
    if (dot(cross(b0.sub(a0), c0.sub(a0)), n) > 0) {
      addTriangle(duct, index, index + 1, index + 2); addTriangle(duct, index, index + 2, index + 3);
    } else {
      addTriangle(duct, index, index + 2, index + 1); addTriangle(duct, index, index + 3, index + 2);
    }
  };
  for (let i = first; i < last; ++i) {
    wall(point(hole0, i), point(hole0, i + 1), point(hole0, i + 1, true), point(hole0, i, true), axis.mul(-1));
    wall(point(hole1, i), point(hole1, i + 1), point(hole1, i + 1, true), point(hole1, i, true), axis);
  }
  wall(point(hole0, first), point(hole1, first), point(hole1, first, true), point(hole0, first, true), up);
  wall(point(hole0, last), point(hole1, last), point(hole1, last, true), point(hole0, last, true), up.mul(-1));
  return meshes;
}

function validDirection(v: FdVector3d): boolean {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) > kEps;
}


function parseDefaultValue(parameter: ApiParameterMetadata): RuntimeValue {
  const text = parameter.defaultValue;
  if (text === '') return runtimeDefaultValueForType(parameter.type);
  if (text === 'true') return true;
  if (text === 'false') return false;
  try {
    if (parameter.type.includes('int') || parameter.type.includes('short')
      || parameter.type.includes('long')) {
      const { value: v, used } = stoll(text);
      if (used === text.length) return v; // static_cast<std::int64_t>(v)
    }
    const { value: v, used } = stod(text);
    if (used === text.length) return v;
  } catch { /* catch (...) {} */ }
  return runtimeDefaultValueForType(parameter.type);
}

function parameterIndex(sig: ApiSignatureMetadata | null, name: string): number {
  if (!sig) return -1;
  for (let i = 0; i < sig.parameters.length; ++i)
    if (sig.parameters[i].name === name) return i;
  return -1;
}

function effectiveArguments(call: RuntimeApiCall): RuntimeValue[] {
  const args: RuntimeValue[] = [];
  for (const arg of call.arguments) args.push(runtimeDeepCopy(arg));
  const sig = apiSignatureMetadataForCall(call);
  if (sig) {
    for (let i = args.length; i < sig.parameters.length; ++i)
      args.push(parseDefaultValue(sig.parameters[i]));
  }
  return args;
}

function startsWith(s: string, prefix: string): boolean {
  return s.startsWith(prefix);
}

// Mesh construction: geometry only, with API ownership supplied by the context.
function buildTaperedTubeMesh(
  context: MeshBuildContext, start: FdPoint3d, end: FdPoint3d,
  diameter1: number, diameter2: number, segments: number): PreviewMesh {
  const mesh = context.createMesh();

  segments = circularFaceCount(segments);
  const r0 = diameter1 * 0.5;
  const r1 = diameter2 * 0.5;
  const p0 = toVec(start);
  const p1 = toVec(end);
  const axis = normalized(p1.sub(p0));
  const [u, v] = stableBasis(axis);

  for (let ring = 0; ring < 2; ++ring) {
    const center = ring === 0 ? p0 : p1;
    const radius = ring === 0 ? r0 : r1;
    for (let i = 0; i < segments; ++i) {
      const angle = 2.0 * kPi * i / segments;
      const radial = u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle)));
      mesh.vertices.push(vertex(center.add(radial.mul(radius)), radial));
    }
  }

  for (let i = 0; i < segments; ++i) {
    const next = (i + 1) % segments;
    const a = i;
    const b = next;
    const c = segments + next;
    const d = segments + i;
    addTriangle(mesh, a, b, c);
    addTriangle(mesh, a, c, d);
  }
  return mesh;
}

function buildDiscMesh(
  context: MeshBuildContext, center: FdPoint3d, normal: FdVector3d,
  diameter: number, segments: number): PreviewMesh {
  const mesh = context.createMesh();

  segments = circularFaceCount(segments);
  const c = toVec(center);
  const n = normalized(toVec(normal));
  const [u, v] = stableBasis(n);
  const radius = diameter * 0.5;

  mesh.vertices.push(vertex(c, n));
  for (let i = 0; i < segments; ++i) {
    const angle = 2.0 * kPi * i / segments;
    mesh.vertices.push(vertex(c.add(u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle))).mul(radius)), n));
  }
  for (let i = 0; i < segments; ++i) {
    const a = 0;
    const b = 1 + i;
    const cidx = 1 + (i + 1) % segments;
    addTriangle(mesh, a, b, cidx);
  }
  return mesh;
}

function buildRingMesh(
  context: MeshBuildContext, center: FdPoint3d, normal: FdVector3d,
  innerDiameter: number, outerDiameter: number, segments: number): PreviewMesh {
  const mesh = context.createMesh();

  segments = circularFaceCount(segments);
  const c = toVec(center);
  const n = normalized(toVec(normal));
  const [u, v] = stableBasis(n);
  const ri = stdMin(Math.abs(innerDiameter), Math.abs(outerDiameter)) * 0.5;
  const ro = stdMax(Math.abs(innerDiameter), Math.abs(outerDiameter)) * 0.5;

  for (let i = 0; i < segments; ++i) {
    const angle = 2.0 * kPi * i / segments;
    const radial = u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle)));
    mesh.vertices.push(vertex(c.add(radial.mul(ri)), n));
    mesh.vertices.push(vertex(c.add(radial.mul(ro)), n));
  }
  for (let i = 0; i < segments; ++i) {
    const j = (i + 1) % segments;
    const i0 = 2 * i;
    const o0 = i0 + 1;
    const i1 = 2 * j;
    const o1 = i1 + 1;
    addTriangle(mesh, i0, o0, o1);
    addTriangle(mesh, i0, o1, i1);
  }
  return mesh;
}

function buildFacettedCylinderMesh(
  context: MeshBuildContext, start: FdPoint3d, end: FdPoint3d,
  upVector: FdVector3d, diameter: number, startAngleDeg: number,
  endAngleDeg: number, complexity: number, front: boolean, back: boolean): PreviewMesh {
  const mesh = context.createMesh();

  const p0 = toVec(start);
  const p1 = toVec(end);
  const axis = normalized(p1.sub(p0));
  const [u, v] = basisFromUp(axis, toVec(upVector));

  let sweepDeg = endAngleDeg - startAngleDeg;
  if (Math.abs(sweepDeg) <= 1e-9) sweepDeg = 360.0;
  const closedSweep = Math.abs(sweepDeg) >= 359.999;
  const sweepFraction = stdMin(1.0, Math.abs(sweepDeg) / 360.0);
  let facetCount = stdMax(1, llroundToInt(complexity * sweepFraction));
  if (closedSweep) facetCount = stdMax(3, complexity);
  facetCount = stdClamp(facetCount, 1, 2048);
  const ringCount = closedSweep ? facetCount : facetCount + 1;
  const radius = diameter * 0.5;

  for (let ring = 0; ring < 2; ++ring) {
    const center = ring === 0 ? p0 : p1;
    for (let i = 0; i < ringCount; ++i) {
      const t = closedSweep
        ? i / facetCount
        : i / facetCount;
      const angle = (startAngleDeg + sweepDeg * t) * kPi / 180.0;
      const radial = u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle)));
      mesh.vertices.push(vertex(center.add(radial.mul(radius)), radial));
    }
  }

  const sideSegments = closedSweep ? facetCount : facetCount;
  for (let i = 0; i < sideSegments; ++i) {
    const next = closedSweep ? (i + 1) % ringCount : i + 1;
    const a = i;
    const b = next;
    const c = ringCount + next;
    const d = ringCount + i;
    addTriangle(mesh, a, b, c);
    addTriangle(mesh, a, c, d);
  }

  const addCap = (enabled: boolean, atEnd: boolean) => {
    if (!enabled) return;
    const center = atEnd ? p1 : p0;
    const capNormal = atEnd ? axis : axis.mul(-1.0);
    const centerIndex = mesh.vertices.length;
    mesh.vertices.push(vertex(center, capNormal));
    const base = atEnd ? ringCount : 0;
    for (let i = 0; i < sideSegments; ++i) {
      const next = closedSweep ? (i + 1) % ringCount : i + 1;
      const a = base + i;
      const b = base + next;
      if (atEnd) addTriangle(mesh, centerIndex, a, b);
      else addTriangle(mesh, centerIndex, b, a);
    }
  };
  addCap(front, false);
  addCap(back, true);
  return mesh;
}

function buildSectionTubeMesh(
  context: MeshBuildContext, centers: FdPoint3d[],
  normals: FdVector3d[], upVectors: FdVector3d[],
  diameters: number[][], complexity: number, numOfSegs: number,
  half: boolean, segment: boolean): PreviewMesh {
  const mesh = context.createMesh();

  const sections = numOfSegs + 1;
  const ringSegments = circularFaceCount(complexity);
  const ringPoints = half ? ringSegments + 1 : ringSegments;
  const sweep = half ? kPi : 2.0 * kPi;

  for (let section = 0; section < sections; ++section) {
    let n = normalized(toVec(normals[section]));
    if (length(n) <= kEps) {
      if (section + 1 < sections) n = normalized(toVec(centers[section + 1]).sub(toVec(centers[section])));
      else if (section > 0) n = normalized(toVec(centers[section]).sub(toVec(centers[section - 1])));
    }
    const [up, side] = basisFromUp(n, toVec(upVectors[section]));
    const rUp = Math.abs(diameters[section][0]) * 0.5;
    const rSide = Math.abs(diameters[section][1]) * 0.5;
    const c = toVec(centers[section]);
    for (let i = 0; i < ringPoints; ++i) {
      const t = half
        ? i / ringSegments
        : i / ringSegments;
      const angle = sweep * t;
      const radial = up.mul(Math.cos(angle) * rUp).add(side.mul(Math.sin(angle) * rSide));
      mesh.vertices.push(vertex(c.add(radial), normalized(radial)));
    }
  }

  for (let section = 0; section < numOfSegs; ++section) {
    for (let i = 0; i < ringSegments; ++i) {
      const next = half ? i + 1 : (i + 1) % ringPoints;
      const a = section * ringPoints + i;
      const b = section * ringPoints + next;
      const c = (section + 1) * ringPoints + next;
      const d = (section + 1) * ringPoints + i;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }

  // The legacy `segment` flag affects exact SDK seam/cap handling. For the
  // preview mesh the side loft is the useful geometry; half-tubes get their
  // open longitudinal edges intentionally left visible.
  void segment;
  return mesh;
}

function buildTorusSectionMesh(
  context: MeshBuildContext, center: FdPoint3d, normal: FdVector3d,
  radVec: FdVector3d, radius: number, diameter: number, sweepAngleDeg: number,
  complexity: number, segmentation: number): PreviewMesh {
  const mesh = context.createMesh();

  const axis = normalized(toVec(normal));
  let radial0 = toVec(radVec).sub(axis.mul(dot(toVec(radVec), axis)));
  if (length(radial0) <= kEps) {
    const [u] = stableBasis(axis);
    radial0 = u;
  } else radial0 = normalized(radial0);

  const crossSegments = circularFaceCount(complexity);
  const sweepSegments = stdClamp(stdMax(1, segmentation), 1, 1024);
  const closed = Math.abs(sweepAngleDeg) >= 359.999;
  const sweepPoints = closed ? sweepSegments : sweepSegments + 1;
  const sweep = sweepAngleDeg * kPi / 180.0;
  const tubeRadius = Math.abs(diameter) * 0.5;
  const c0 = toVec(center);

  for (let s = 0; s < sweepPoints; ++s) {
    const t = closed
      ? s / sweepSegments
      : s / sweepSegments;
    const angle = sweep * t;
    const radial = normalized(rotateAroundAxis(radial0, axis, angle));
    const ringCenter = c0.add(radial.mul(radius));
    for (let j = 0; j < crossSegments; ++j) {
      const phi = 2.0 * kPi * j / crossSegments;
      const offsetDir = normalized(radial.mul(Math.cos(phi)).add(axis.mul(Math.sin(phi))));
      mesh.vertices.push(vertex(ringCenter.add(offsetDir.mul(tubeRadius)), offsetDir));
    }
  }

  const longitudinalSegments = closed ? sweepSegments : sweepSegments;
  for (let s = 0; s < longitudinalSegments; ++s) {
    const sn = closed ? (s + 1) % sweepPoints : s + 1;
    for (let j = 0; j < crossSegments; ++j) {
      const jn = (j + 1) % crossSegments;
      const a = s * crossSegments + j;
      const b = s * crossSegments + jn;
      const c = sn * crossSegments + jn;
      const d = sn * crossSegments + j;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }
  return mesh;
}

function buildSpheroidSectionMesh(
  context: MeshBuildContext, center: FdPoint3d, normal: FdVector3d,
  bVector: FdVector3d, latAngles: number[],
  longAngles: number[], diameters: number[],
  complexity: number[]): PreviewMesh {
  const mesh = context.createMesh();

  // SDK axes:
  //   A axis = normal
  //   B axis = bVector
  //   C axis = perpendicular to A and B
  // The centroid is the actual geometry position; the vectors only orient
  // these axes and never contribute translation.
  const aAxis = normalized(toVec(normal));
  let bAxis = toVec(bVector).sub(aAxis.mul(dot(toVec(bVector), aAxis)));
  if (length(bAxis) <= kEps) {
    const [u] = stableBasis(aAxis);
    bAxis = u;
  } else {
    bAxis = normalized(bAxis);
  }
  const cAxis = normalized(cross(aAxis, bAxis));
  const centroid = toVec(center);

  // The documented order is {lengthA, lengthB, lengthC}.
  const rA = Math.abs(diameters[0]) * 0.5;
  const rB = Math.abs(diameters[1]) * 0.5;
  const rC = Math.abs(diameters[2]) * 0.5;
  const latSteps = stdClamp(stdMax(1, complexity[0]), 1, 512);
  const lonSteps = stdClamp(stdMax(1, complexity[1]), 1, 1024);
  const lat0 = latAngles[0] * kPi / 180.0;
  const lat1 = latAngles[1] * kPi / 180.0;
  const lon0 = longAngles[0] * kPi / 180.0;
  const lon1 = longAngles[1] * kPi / 180.0;

  // Latitude in the SDK is 0 at the bottom of A, 90 at the equator and
  // 180 at the top. Longitude starts on +B and rotates around +A by the
  // right-hand rule.
  for (let i = 0; i <= latSteps; ++i) {
    const u = i / latSteps;
    const lat = lat0 + (lat1 - lat0) * u;
    const sl = Math.sin(lat);
    const cl = Math.cos(lat);
    for (let j = 0; j <= lonSteps; ++j) {
      const v = j / lonSteps;
      const lon = lon0 + (lon1 - lon0) * v;
      const co = Math.cos(lon);
      const so = Math.sin(lon);

      const local = aAxis.mul(-rA * cl)
        .add(bAxis.mul(rB * sl * co))
        .add(cAxis.mul(rC * sl * so));
      const surfaceNormal = aAxis.mul(rA > kEps ? -cl / rA : 0.0)
        .add(bAxis.mul(rB > kEps ? sl * co / rB : 0.0))
        .add(cAxis.mul(rC > kEps ? sl * so / rC : 0.0));
      mesh.vertices.push(vertex(centroid.add(local), normalized(surfaceNormal)));
    }
  }

  const stride = lonSteps + 1;
  for (let i = 0; i < latSteps; ++i) {
    for (let j = 0; j < lonSteps; ++j) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j + 1;
      const d = (i + 1) * stride + j;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }
  return mesh;
}

function buildRectFaceMesh(
  context: MeshBuildContext, center: FdPoint3d, normal: FdVector3d,
  upVector: FdVector3d, height: number, width: number): PreviewMesh {
  const mesh = context.createMesh();

  const n = normalized(toVec(normal));
  let up = toVec(upVector).sub(n.mul(dot(toVec(upVector), n)));
  if (length(up) <= kEps) {
    const [, v] = stableBasis(n);
    up = v;
  } else up = normalized(up);
  const right = normalized(cross(n, up));
  const c = toVec(center);
  const hh = Math.abs(height) * 0.5;
  const hw = Math.abs(width) * 0.5;
  mesh.vertices = [
    vertex(c.add(right.mul(hw)).add(up.mul(hh)), n),
    vertex(c.sub(right.mul(hw)).add(up.mul(hh)), n),
    vertex(c.sub(right.mul(hw)).sub(up.mul(hh)), n),
    vertex(c.add(right.mul(hw)).sub(up.mul(hh)), n)];
  addTriangle(mesh, 0, 1, 2);
  addTriangle(mesh, 0, 2, 3);
  return mesh;
}

function buildCircleOutlineMesh(
  context: MeshBuildContext, center: FdPoint3d, normal: FdVector3d,
  diameter: number): PreviewMesh {
  const outer = Math.abs(diameter);
  const lineWidth = stdMax(outer * 0.025, 0.05);
  const mesh = buildRingMesh(
    context, center, normal,
    stdMax(0.0, outer - lineWidth * 2.0), outer, 12);
  return mesh;
}

function buildBoxMesh(
  context: MeshBuildContext, count: number, centers: FdPoint3d[],
  normals: FdVector3d[], upVectors: FdVector3d[],
  widths: number[], heights: number[],
  sides: boolean[], beginning: boolean, endCap: boolean): PreviewMesh {
  const mesh = context.createMesh();

  const sections = count + 1;
  const corners: DVec3[] = [];

  for (let s = 0; s < sections; ++s) {
    let normal = normalized(toVec(normals[s]));
    let up = normalized(toVec(upVectors[s]));
    if (length(normal) <= kEps && s + 1 < sections)
      normal = normalized(toVec(centers[s + 1]).sub(toVec(centers[s])));
    if (length(up) <= kEps) up = new DVec3(0, 0, 1);
    // Re-orthogonalize the supplied up vector against the section normal.
    up = up.sub(normal.mul(dot(up, normal)));
    if (length(up) <= kEps) {
      const [, fallbackV] = stableBasis(normal);
      up = fallbackV;
    } else up = normalized(up);
    let right = normalized(cross(normal, up));
    if (length(right) <= kEps) {
      const [fallbackU, fallbackV] = stableBasis(normal);
      right = fallbackU;
      up = fallbackV;
    }

    const hw = Math.abs(widths[s]) * 0.5;
    const hh = Math.abs(heights[s]) * 0.5;
    const c = toVec(centers[s]);
    corners.push(c.add(right.mul(hw)).add(up.mul(hh)));
    corners.push(c.sub(right.mul(hw)).add(up.mul(hh)));
    corners.push(c.sub(right.mul(hw)).sub(up.mul(hh)));
    corners.push(c.add(right.mul(hw)).sub(up.mul(hh)));
  }

  // Section vertices are shared by adjoining walls and caps. The viewport
  // derives shading normals from their faces to preserve these sharp edges.
  for (let s = 0; s < sections; ++s) {
    const n = normalized(toVec(normals[s]));
    for (let k = 0; k < 4; ++k)
      mesh.vertices.push(vertex(corners[s * 4 + k], n));
  }

  for (let s = 0; s < count; ++s) {
    for (let side = 0; side < 4; ++side) {
      const sideIndex = s * 4 + side;
      if (sideIndex < sides.length && !sides[sideIndex]) continue;
      const nextSide = (side + 1) % 4;
      const a = s * 4 + side;
      const b = s * 4 + nextSide;
      const c = (s + 1) * 4 + nextSide;
      const d = (s + 1) * 4 + side;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }

  if (beginning) {
    addTriangle(mesh, 0, 2, 1);
    addTriangle(mesh, 0, 3, 2);
  }
  if (endCap) {
    const base = count * 4;
    addTriangle(mesh, base, base + 1, base + 2);
    addTriangle(mesh, base, base + 2, base + 3);
  }
  return mesh;
}

function buildPolygonFaceMesh(
  context: MeshBuildContext, points: FdPoint3d[]): PreviewMesh {
  const mesh = context.createMesh();
  if (points.length < 3) return mesh;

  let n = new DVec3(0, 0, 1);
  for (let i = 2; i < points.length; ++i) {
    const candidate = cross(toVec(points[i - 1]).sub(toVec(points[0])), toVec(points[i]).sub(toVec(points[0])));
    if (length(candidate) > kEps) { n = normalized(candidate); break; }
  }
  for (const p of points) mesh.vertices.push(vertex(toVec(p), n));
  for (let i = 1; i + 1 < points.length; ++i)
    addTriangle(mesh, 0, i, i + 1);
  return mesh;
}

// API adapters: decode SDK arguments before invoking mesh builders.
// Return true for a recognized API, including a call rejected with a diagnostic.
function appendPrimitiveApiMeshes(
  scene: PreviewGeometryScene, context: MeshBuildContext,
  args: RuntimeValue[]): boolean {
  const call = context.call;
  if (call.name === 'makeVerySimpleTube') {
    const start = ref(new FdPoint3d()), end = ref(new FdPoint3d());
    const diameter = ref(0.0);
    const segments = ref(0);
    let ok = false;
    if (args.length === 4) {
      ok = asPoint(args[0], start)
        && asPoint(args[1], end)
        && asNumber(args[2], diameter)
        && asInt(args[3], segments);
    } else if (args.length === 3) {
      ok = twoPointsFromArray(args[0], start, end)
        && asNumber(args[1], diameter)
        && asInt(args[2], segments);
    }
    if (!ok) { scene.warnings.push(warningFor(call, 'unsupported or invalid arguments')); return true; }
    if (diameter.v <= 0.0 || segments.v < 1 || length(toVec(end.v).sub(toVec(start.v))) <= kEps) {
      scene.warnings.push(warningFor(call, 'invalid tube dimensions')); return true;
    }
    scene.meshes.push(buildTaperedTubeMesh(context, start.v, end.v, diameter.v, diameter.v, segments.v));
    return true;
  }

  if (call.name === 'makeSimpleTube') {
    const start = ref(new FdPoint3d()), end = ref(new FdPoint3d());
    const diameter1 = ref(0.0), diameter2 = ref(0.0);
    const segments = ref(0);
    let ok = false;
    if (args.length === 5) {
      ok = asPoint(args[0], start)
        && asPoint(args[1], end)
        && asNumber(args[2], diameter1)
        && asNumber(args[3], diameter2)
        && asInt(args[4], segments);
    } else if (args.length === 4) {
      ok = twoPointsFromArray(args[0], start, end)
        && asNumber(args[1], diameter1)
        && asNumber(args[2], diameter2)
        && asInt(args[3], segments);
    }
    if (!ok) { scene.warnings.push(warningFor(call, 'unsupported or invalid arguments')); return true; }
    if (diameter1.v <= 0.0 || diameter2.v <= 0.0 || segments.v < 1 || length(toVec(end.v).sub(toVec(start.v))) <= kEps) {
      scene.warnings.push(warningFor(call, 'invalid simple-tube dimensions')); return true;
    }
    scene.meshes.push(buildTaperedTubeMesh(context, start.v, end.v, diameter1.v, diameter2.v, segments.v));
    return true;
  }

  if (call.name === 'makeFlatDisc' && args.length === 4) {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d());
    const diameter = ref(0.0);
    const segments = ref(0);
    if (!asPoint(args[0], center) || !asVector(args[1], normal)
      || !asNumber(args[2], diameter) || !asInt(args[3], segments)) {
      scene.warnings.push(warningFor(call, 'invalid disc arguments')); return true;
    }
    if (!validDirection(normal.v) || diameter.v <= 0.0 || segments.v < 1) {
      scene.warnings.push(warningFor(call, 'invalid disc dimensions/normal')); return true;
    }
    scene.meshes.push(buildDiscMesh(context, center.v, normal.v, diameter.v, segments.v));
    return true;
  }

  if (call.name === 'makeFlatRing' && args.length === 5) {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d());
    const innerDiameter = ref(0.0), outerDiameter = ref(0.0);
    const segments = ref(0);
    if (!asPoint(args[0], center) || !asVector(args[1], normal)
      || !asNumber(args[2], innerDiameter) || !asNumber(args[3], outerDiameter)
      || !asInt(args[4], segments)) {
      scene.warnings.push(warningFor(call, 'invalid ring arguments')); return true;
    }
    // Legacy project code is not consistent about which diameter is
    // passed first. The public signature names them inner/outer, but
    // several real calls reverse the numeric order. Preview therefore
    // accepts either order and normalizes it in buildRingMesh().
    if (!validDirection(normal.v) || innerDiameter.v < 0.0 || outerDiameter.v < 0.0
      || Math.abs(innerDiameter.v - outerDiameter.v) <= kEps || segments.v < 1) {
      scene.warnings.push(warningFor(call, 'invalid ring dimensions/normal')); return true;
    }
    scene.meshes.push(buildRingMesh(context, center.v, normal.v, innerDiameter.v, outerDiameter.v, segments.v));
    return true;
  }

  if (call.name === 'makeFacettedCylinder' && args.length === 9) {
    const start = ref(new FdPoint3d()), end = ref(new FdPoint3d());
    const up = ref(new FdVector3d());
    const diameter = ref(0.0), startAngle = ref(0.0), endAngle = ref(0.0), complexityD = ref(0.0);
    const front = ref(false), back = ref(false);
    if (!asPoint(args[0], start) || !asPoint(args[1], end)
      || !asVector(args[2], up) || !asNumber(args[3], diameter)
      || !asNumber(args[4], startAngle) || !asNumber(args[5], endAngle)
      || !asNumber(args[6], complexityD) || !asBool(args[7], front)
      || !asBool(args[8], back)) {
      scene.warnings.push(warningFor(call, 'invalid facetted-cylinder arguments')); return true;
    }
    const complexity = llroundToInt(complexityD.v);
    if (diameter.v <= 0.0 || complexity < 1 || length(toVec(end.v).sub(toVec(start.v))) <= kEps) {
      scene.warnings.push(warningFor(call, 'invalid facetted-cylinder dimensions')); return true;
    }
    scene.meshes.push(buildFacettedCylinderMesh(
      context, start.v, end.v, up.v, diameter.v, startAngle.v, endAngle.v,
      complexity, front.v, back.v));
    return true;
  }

  if (call.name === 'makeDisc' && args.length === 6) {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d());
    const diameter = ref(0.0), thickness = ref(0.0);
    const segments = ref(0);
    const segment = ref(false);
    if (!asPoint(args[0], center) || !asVector(args[1], normal)
      || !asNumber(args[2], diameter) || !asNumber(args[3], thickness)
      || !asInt(args[4], segments) || !asBool(args[5], segment)) {
      scene.warnings.push(warningFor(call, 'invalid disc arguments')); return true;
    }
    if (!validDirection(normal.v) || diameter.v <= 0.0 || thickness.v < 0.0 || segments.v < 1) {
      scene.warnings.push(warningFor(call, 'invalid disc dimensions/normal')); return true;
    }
    const n = normalized(toVec(normal.v));
    const c = toVec(center.v);
    const [up] = stableBasis(n); // C++: stableBasis(n, up, side); side is unused.
    const start = toPoint(c.sub(n.mul(thickness.v * 0.5)));
    const end = toPoint(c.add(n.mul(thickness.v * 0.5)));
    scene.meshes.push(buildFacettedCylinderMesh(
      context, start, end, toFdVector(up), diameter.v, 0.0, 360.0,
      circularFaceCount(segments.v), true, true));
    return true;
  }

  if (call.name === 'makeDonutSection' && args.length === 8) {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d()), radVec = ref(new FdVector3d());
    const radius = ref(0.0), diameter = ref(0.0), sweep = ref(0.0);
    const complexity = ref(0), segmentation = ref(0);
    if (!asPoint(args[0], center) || !asVector(args[1], normal)
      || !asVector(args[2], radVec) || !asNumber(args[3], radius)
      || !asNumber(args[4], diameter) || !asNumber(args[5], sweep)
      || !asInt(args[6], complexity) || !asInt(args[7], segmentation)) {
      scene.warnings.push(warningFor(call, 'invalid donut arguments')); return true;
    }
    if (!validDirection(normal.v) || !validDirection(radVec.v) || radius.v < 0.0 || diameter.v <= 0.0
      || complexity.v < 1 || segmentation.v < 1 || Math.abs(sweep.v) <= kEps) {
      scene.warnings.push(warningFor(call, 'invalid donut dimensions/vectors')); return true;
    }
    scene.meshes.push(buildTorusSectionMesh(
      context, center.v, normal.v, radVec.v, radius.v, diameter.v, sweep.v,
      complexity.v, segmentation.v));
    return true;
  }

  if (call.name === 'makeTube' && (args.length === 8 || args.length === 7)) {
    const centers: FdPoint3d[] = [];
    const normals: FdVector3d[] = [], upVectors: FdVector3d[] = [];
    const diameters: number[][] = [];
    const complexity = ref(0), numOfSegs = ref(0);
    const half = ref(false), segment = ref(false);
    let ok = pointArray(args[0], centers) && vectorArray(args[1], normals);
    let complexityIndex = 0;
    if (args.length === 8) {
      ok = ok && vectorArray(args[2], upVectors) && numberMatrix(args[3], diameters);
      complexityIndex = 4; // diamIndex = 3
    } else {
      ok = ok && numberMatrix(args[2], diameters);
      complexityIndex = 3; // diamIndex = 2
    }
    ok = ok && asInt(args[complexityIndex], complexity)
      && asInt(args[complexityIndex + 1], numOfSegs)
      && asBool(args[complexityIndex + 2], half)
      && asBool(args[complexityIndex + 3], segment);
    if (!ok) { scene.warnings.push(warningFor(call, 'invalid makeTube arguments')); return true; }
    const sections = stdMax(0, numOfSegs.v) + 1;
    if (numOfSegs.v < 1 || complexity.v < 1 || centers.length < sections || normals.length < sections
      || diameters.length < sections) {
      scene.warnings.push(warningFor(call, 'makeTube arrays must contain numOfSegs+1 sections')); return true;
    }
    if (upVectors.length === 0) {
      for (let section = 0; section < sections; ++section) {
        upVectors.push(sdkPerpVector(normals[section]));
      }
    }
    if (upVectors.length < sections) {
      scene.warnings.push(warningFor(call, 'makeTube up-vector array is too small')); return true;
    }
    let validDiameters = true;
    for (let section = 0; section < sections; ++section)
      validDiameters = validDiameters && diameters[section].length >= 2;
    if (!validDiameters) { scene.warnings.push(warningFor(call, 'makeTube diameters require [][2]')); return true; }
    scene.meshes.push(buildSectionTubeMesh(
      context, centers, normals, upVectors, diameters,
      complexity.v, numOfSegs.v, half.v, segment.v));
    return true;
  }

  if (call.name === 'makeSpheroidSection' && (args.length === 7 || args.length === 6)) {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d()), bVector = ref(new FdVector3d());
    const latAngles: number[] = [], longAngles: number[] = [], diameters: number[] = [];
    const complexity: number[] = [];
    let ok = asPoint(args[0], center) && asVector(args[1], normal);
    let latIndex = 0;
    if (args.length === 7) {
      ok = ok && asVector(args[2], bVector);
      latIndex = 3;
    } else {
      bVector.v = sdkPerpVector(normal.v);
      latIndex = 2;
    }
    ok = ok && numberArray(args[latIndex], latAngles)
      && numberArray(args[latIndex + 1], longAngles)
      && numberArray(args[latIndex + 2], diameters)
      && intArray(args[latIndex + 3], complexity);
    if (!ok || latAngles.length < 2 || longAngles.length < 2 || diameters.length < 3 || complexity.length < 2
      || !validDirection(normal.v) || !validDirection(bVector.v)) {
      scene.warnings.push(warningFor(call, 'invalid spheroid arguments')); return true;
    }
    scene.meshes.push(buildSpheroidSectionMesh(
      context, center.v, normal.v, bVector.v,
      latAngles, longAngles, diameters, complexity));
    return true;
  }

  if (call.name === 'makeRectFace' && args.length === 5) {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d()), up = ref(new FdVector3d());
    const height = ref(0.0), width = ref(0.0);
    if (!asPoint(args[0], center) || !asVector(args[1], normal)
      || !asVector(args[2], up) || !asNumber(args[3], height)
      || !asNumber(args[4], width)) {
      scene.warnings.push(warningFor(call, 'invalid rect-face arguments')); return true;
    }
    if (!validDirection(normal.v) || !validDirection(up.v) || height.v <= 0.0 || width.v <= 0.0) {
      scene.warnings.push(warningFor(call, 'invalid rect-face dimensions/vectors')); return true;
    }
    scene.meshes.push(buildRectFaceMesh(context, center.v, normal.v, up.v, height.v, width.v));
    return true;
  }

  if (call.name === 'makeScrew' && (args.length === 6 || args.length === 7)) {
    const start = ref(new FdPoint3d());
    const direction = ref(new FdVector3d()), up = ref(new FdVector3d());
    const diameter = ref(0.0), screwLength = ref(0.0);
    const back = ref(false), front = ref(true);
    if (!asPoint(args[0], start) || !asVector(args[1], direction)
      || !asVector(args[2], up) || !asNumber(args[3], diameter)
      || !asNumber(args[4], screwLength) || !asBool(args[5], back)
      || (args.length === 7 && !asBool(args[6], front))) {
      scene.warnings.push(warningFor(call, 'invalid screw arguments')); return true;
    }
    if (!validDirection(direction.v) || diameter.v <= 0.0 || Math.abs(screwLength.v) <= kEps) {
      scene.warnings.push(warningFor(call, 'invalid screw dimensions/vector')); return true;
    }
    const dir = normalized(toVec(direction.v));
    const end = toPoint(toVec(start.v).add(dir.mul(screwLength.v)));
    scene.meshes.push(buildFacettedCylinderMesh(
      context, start.v, end, up.v, diameter.v, 0.0, 360.0, 6, front.v, back.v));
    return true;
  }

  // makeBend2 has multiple SDK overloads whose alpha/beta and R11/R12
  // parameters materially change the surface. Do not render the old
  // single-radius approximation; unsupported overloads are reported below.

  if (call.name === 'makeSymbolicCircle' && args.length === 3) {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d());
    const diameter = ref(0.0);
    if (!asPoint(args[0], center) || !asVector(args[1], normal)
      || !asNumber(args[2], diameter)) {
      scene.warnings.push(warningFor(call, 'invalid symbolic-circle arguments')); return true;
    }
    if (!validDirection(normal.v) || diameter.v <= 0.0) {
      scene.warnings.push(warningFor(call, 'invalid symbolic-circle dimensions/normal')); return true;
    }
    scene.meshes.push(buildCircleOutlineMesh(context, center.v, normal.v, diameter.v));
    return true;
  }

  if (call.name === 'makeBox' || call.name === 'makeBoxFromPlanes') {
    const sig = apiSignatureMetadataForCall(call);
    const count = ref(0);
    const centers: FdPoint3d[] = [];
    if (args.length < 2 || !asInt(args[0], count) || !pointArray(args[1], centers)) {
      scene.warnings.push(warningFor(call, 'invalid makeBox count/centralPoints'));
      return true;
    }
    if (count.v < 0 || centers.length < count.v + 1) {
      scene.warnings.push(warningFor(call, 'makeBox centralPoints must contain count+1 sections'));
      return true;
    }

    let normals: FdVector3d[] = Array.from({ length: count.v + 1 }, () => new FdVector3d());
    const vectorsIndex = parameterIndex(sig, 'vectors');
    if (vectorsIndex >= 0 && vectorsIndex < args.length) {
      const supplied: FdVector3d[] = [];
      if (!vectorArray(args[vectorsIndex], supplied)
        || supplied.length < count.v + 1) {
        scene.warnings.push(warningFor(call, 'makeBox vectors must contain count+1 entries'));
        return true;
      }
      normals = supplied.slice(0, count.v + 1);
    } else {
      for (let i = 0; i <= count.v; ++i) {
        let dir = new DVec3();
        if (i < count.v) dir = toVec(centers[i + 1]).sub(toVec(centers[i]));
        else if (i > 0) dir = toVec(centers[i]).sub(toVec(centers[i - 1]));
        normals[i] = toFdVector(normalized(dir));
      }
    }

    for (const n of normals) {
      if (!validDirection(n)) {
        scene.warnings.push(warningFor(call, 'makeBox section vector is zero'));
        return true;
      }
    }

    {
      let upVectors: FdVector3d[] = Array.from({ length: count.v + 1 }, () => new FdVector3d());
      const upIndex = parameterIndex(sig, 'upVectors');
      if (upIndex >= 0 && upIndex < args.length) {
        const supplied: FdVector3d[] = [];
        if (!vectorArray(args[upIndex], supplied)
          || supplied.length < count.v + 1) {
          scene.warnings.push(warningFor(call, 'makeBox upVectors must contain count+1 entries'));
          return true;
        }
        upVectors = supplied.slice(0, count.v + 1);
      } else {
        for (let i = 0; i <= count.v; ++i) {
          // SDK documentation specifies that omitted upVectors are
          // produced by vector.perpVector(). Keep the renderer in
          // sync with GeometryRuntime::FdVector3d::perpVector rather
          // than choosing the second axis of an arbitrary basis.
          upVectors[i] =
            sdkPerpVector(normals[i]);
        }
      }

      const dimensionsFor = (arrayName: string, scalarName: string, out: number[]): boolean => {
        let idx = parameterIndex(sig, arrayName);
        if (idx < 0) idx = parameterIndex(sig, scalarName);
        if (idx < 0 || idx >= args.length) return false;
        if (numberArray(args[idx], out))
          return out.length >= count.v + 1;
        const scalar = ref(0.0);
        if (!asNumber(args[idx], scalar)) return false;
        out.length = 0; // out.assign(count + 1, scalar)
        for (let i = 0; i < count.v + 1; ++i) out.push(scalar.v);
        return true;
      };

      const widths: number[] = [], heights: number[] = [];
      if (!dimensionsFor('tabWidth', 'width', widths) || !dimensionsFor('tabHeight', 'height', heights)) {
        scene.warnings.push(warningFor(call, 'makeBox width/height arguments are invalid'));
        return true;
      }

      const sides: boolean[] = new Array<boolean>(stdMax(0, count.v) * 4).fill(true);
      const sidesIndex = parameterIndex(sig, 'sides');
      if (sidesIndex >= 0 && sidesIndex < args.length) {
        const supplied: boolean[] = [];
        if (!boolArray(args[sidesIndex], supplied)) {
          scene.warnings.push(warningFor(call, 'makeBox sides argument is invalid'));
          return true;
        }
        for (let i = 0; i < sides.length && i < supplied.length; ++i) sides[i] = supplied[i];
      }

      const beginning = ref(false), endCap = ref(false);
      const beginIndex = parameterIndex(sig, 'begining') >= 0 ? parameterIndex(sig, 'begining') : parameterIndex(sig, 'begin');
      const endIndex = parameterIndex(sig, 'end');
      if (beginIndex >= 0 && beginIndex < args.length) asBool(args[beginIndex], beginning);
      if (endIndex >= 0 && endIndex < args.length) asBool(args[endIndex], endCap);

      scene.meshes.push(buildBoxMesh(
        context, count.v, centers, normals, upVectors, widths, heights,
        sides, beginning.v, endCap.v));

      const connector1Side = ref(5), connector2Side = ref(5);
      let connectorWidth = 30.0;
      const connectorsIndex = parameterIndex(sig, 'connectors');
      if (connectorsIndex >= 0 && connectorsIndex < args.length) {
        const enabled = ref(false); if (asBool(args[connectorsIndex], enabled) && enabled.v) connector1Side.v = connector2Side.v = 0;
      }
      const connectorIndex = parameterIndex(sig, 'connector');
      if (connectorIndex >= 0 && connectorIndex < args.length) {
        const c: boolean[] = [];
        if (boolArray(args[connectorIndex], c)) {
          if (c.length !== 0 && c[0]) connector1Side.v = 0;
          if (c.length > 1 && c[1]) connector2Side.v = 0;
        } else { const enabled = ref(false); if (asBool(args[connectorIndex], enabled) && enabled.v) connector1Side.v = connector2Side.v = 0; }
      }
      const c1Index = parameterIndex(sig, 'connector1Side');
      const c2Index = parameterIndex(sig, 'connector2Side');
      const cwIndex = parameterIndex(sig, 'connectorWidth');
      if (c1Index >= 0 && c1Index < args.length) asInt(args[c1Index], connector1Side);
      if (c2Index >= 0 && c2Index < args.length) asInt(args[c2Index], connector2Side);
      if (cwIndex >= 0 && cwIndex < args.length) {
        const w = ref(0.0);
        if (asNumber(args[cwIndex], w))
          connectorWidth = stdMax(0.0, w.v);
      }

      if (connector1Side.v !== 5) {
        const connector = buildConnectorSleeveMesh(context, centers[0], normals[0], upVectors[0], widths[0], heights[0], connectorWidth, connector1Side.v, -1.0);
        connector.apiName += '.connector';
        if (connector.indices.length !== 0) scene.meshes.push(connector);
      }
      if (connector2Side.v !== 5) {
        const connector = buildConnectorSleeveMesh(context, centers[count.v], normals[count.v], upVectors[count.v], widths[count.v], heights[count.v], connectorWidth, connector2Side.v, 1.0);
        connector.apiName += '.connector';
        if (connector.indices.length !== 0) scene.meshes.push(connector);
      }
    }
    return true;
  }
  return false;
}

function appendCompositeApiMeshes(
  scene: PreviewGeometryScene, context: MeshBuildContext,
  args: RuntimeValue[]): boolean { // C++ parameter name: `arguments`
  const call = context.call;
  if (call.userFunctionCall) return false;

  const sig = apiSignatureMetadataForCall(call);
  const header = sig ? sig.sourceHeader : '';
  const geometryHeader = header === 'SymbolsInt.h' || header === 'GrillsInt.h'
    || header === 'TubularPrimitivesInt.h' || header === 'RectangularPrimitivesInt.h'
    || header === 'VascoPrimitivesInt.h' || header === 'BowlPrimitivesInt.h'
    || header === 'GeoCache3dInt.h';
  const geometryName = startsWith(call.name, 'make') || startsWith(call.name, 'add') || startsWith(call.name, 'draw');
  if (!geometryHeader && !geometryName) return false;
  if (startsWith(call.name, 'append') || startsWith(call.name, 'calc') || call.name === 'SidePoints') return false;

  const push = (mesh: PreviewMesh) => {
    if (mesh.vertices.length === 0 || mesh.indices.length === 0) return;
    scene.meshes.push(mesh);
  };
  // Adapters below are limited to behaviors documented by the supplied SDK interfaces.

  // Exact adapters for the remaining common rectangular primitives.
  if (call.name === 'makePlane') {
    // points[4] overload: positions alone define the plane.
    const planePoints: FdPoint3d[] = [];
    if (args.length !== 0 && pointArray(args[0], planePoints) && planePoints.length >= 4) {
      push(buildPolygonFaceMesh(context, planePoints.slice(0, 4)));
      return true;
    }
    // p1,p2,p3,p4 overload.
    if (args.length >= 4) {
      const p1 = ref(new FdPoint3d()), p2 = ref(new FdPoint3d()), p3 = ref(new FdPoint3d()), p4 = ref(new FdPoint3d());
      if (asPoint(args[0], p1) && asPoint(args[1], p2)
        && asPoint(args[2], p3) && asPoint(args[3], p4)) {
        push(buildPolygonFaceMesh(context, [p1.v, p2.v, p3.v, p4.v]));
        return true;
      }
    }
    // cp is the position. normal/upVector form the local frame; H/L are
    // measured along upVector and normal x upVector respectively.
    if (args.length >= 5) {
      const cp = ref(new FdPoint3d()); const normal = ref(new FdVector3d()), up = ref(new FdVector3d()); const h = ref(0.0), l = ref(0.0);
      if (asPoint(args[0], cp) && asVector(args[1], normal)
        && asVector(args[2], up) && asNumber(args[3], h)
        && asNumber(args[4], l) && validDirection(normal.v)
        && validDirection(up.v) && h.v > 0.0 && l.v > 0.0) {
        push(buildRectFaceMesh(context, cp.v, normal.v, up.v, h.v, l.v));
        return true;
      }
    }
    return false;
  }
  // makeEllipticalPlane uses a tangent vector and (in one overload) an
  // up-vector to orient a plane around centralPoint. The supplied docs do
  // not define R1/R2 as the two semi-axes of an ellipse; they are described
  // as inner/exterior bend radii. Do not reinterpret those vectors or radii
  // as a different primitive. Until the exact bend-derived construction is
  // implemented, leave this API unsupported rather than draw a misleading
  // plane in the wrong orientation.
  if (call.name === 'makeEllipticalPlane') return false;

  if (call.name === 'makeRectToTubeTransition') {
    // This API is fully handled here. Never let it fall through to a
    // generic "Rect"/"Transition" proxy because that produces a shape
    // unrelated to the SDK primitive.
    if (args.length !== 7) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeTransition expects 7 evaluated arguments'));
      return true;
    }

    const start = ref(new FdPoint3d()), tubeStart = ref(new FdPoint3d());
    const normal = ref(new FdVector3d()), upVector = ref(new FdVector3d());
    const tubeDiams: number[] = [];
    const complexity = ref(0);
    const hasComplexity = asInt(args[6], complexity);
    if (!asPoint(args[0], start) || !asVector(args[1], normal)
      || !asVector(args[2], upVector) || !asPoint(args[4], tubeStart)
      || !numberArray(args[5], tubeDiams)) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeTransition position/orientation/dimension arguments could not be evaluated'));
      return true;
    }
    // Complexity only controls tessellation. If a standalone snippet refers
    // to a project-level constant (for example `cpx`) that is not present in
    // the pasted source, keep the geometry previewable with a renderer-only
    // sampling value. The runtime diagnostic and API Trace still show the
    // unresolved original expression; no position, orientation or dimension
    // is invented here.
    if (!hasComplexity) {
      complexity.v = 10;
      scene.warnings.push(warningFor(call,
        'makeRectToTubeTransition complexity is unresolved; using preview tessellation n=10'));
    }
    if (!validDirection(normal.v) || !validDirection(upVector.v) || tubeDiams.length < 3
      || tubeDiams[0] <= 0.0 || tubeDiams[1] <= 0.0
      || Math.abs(tubeDiams[2]) <= kEps || complexity.v < 1) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeTransition has invalid normal/upVector, tube diameters or tube length'));
      return true;
    }

    // Overload 1: corners[4]. Overload 2: heightWidth[2].
    let corners: FdPoint3d[] = [];
    if (!pointArray(args[3], corners)) {
      const heightWidth: number[] = [];
      if (!numberArray(args[3], heightWidth) || heightWidth.length < 2
        || heightWidth[0] <= 0.0 || heightWidth[1] <= 0.0) {
        scene.warnings.push(warningFor(call,
          'makeRectToTubeTransition requires corners[4] or positive heightWidth[2]'));
        return true;
      }
      // start is the rectangle position. normal/upVector only define
      // its local orientation. height follows upVector and width follows
      // normal x upVector, matching the SDK documentation.
      corners = rectangleCorners(start.v, normal.v, upVector.v,
        heightWidth[0], heightWidth[1]);
    }
    if (corners.length < 4) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeTransition corners array must contain four points'));
      return true;
    }
    corners.length = 4; // corners.resize(4)

    const transition = buildRectToEllipseTransitionMesh(
      context, corners, start.v, normal.v, upVector.v, tubeStart.v,
      tubeDiams[0], tubeDiams[1], complexity.v);
    transition.apiName += '.transition';
    if (transition.vertices.length === 0 || transition.indices.length === 0) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeTransition could not build the rectangle-to-ellipse loft'));
      return true;
    }
    push(transition);

    // The tube shares the same normal as the rectangular plane. tubeStart
    // is its position and tubeDiams[2] is the signed axial length.
    const n = normalized(toVec(normal.v));
    const tubeEnd = toPoint(toVec(tubeStart.v).add(n.mul(tubeDiams[2])));
    const centers = [tubeStart.v, tubeEnd];
    const normals = [normal.v, normal.v];
    const ups = [upVector.v, upVector.v];
    const diameters = [
      [tubeDiams[0], tubeDiams[1]], [tubeDiams[0], tubeDiams[1]]];
    const tube = buildSectionTubeMesh(
      context, centers, normals, ups, diameters,
      complexity.v, 1, false, false);
    tube.apiName += '.tube';
    if (tube.vertices.length === 0 || tube.indices.length === 0) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeTransition could not build the elliptical tube'));
      return true;
    }
    push(tube);
    return true;
  }

  if (call.name === 'makeRectToTubeIntersection') {
    if (args.length !== 6 && args.length !== 7) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeIntersection expects 6 or 7 evaluated arguments'));
      return true;
    }
    const start = ref(new FdPoint3d());
    const normal = ref(new FdVector3d()), upVector = ref(new FdVector3d());
    const tubeParams: number[] = [], ductPosition: number[] = [], ductParams: number[] = [];
    const complexity = ref(0);

    let tubeIndex = 0;
    if (!asPoint(args[0], start) || !asVector(args[1], normal)) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeIntersection start/normal could not be evaluated'));
      return true;
    }
    if (args.length === 7) {
      if (!asVector(args[2], upVector)) {
        scene.warnings.push(warningFor(call,
          'makeRectToTubeIntersection upVector could not be evaluated'));
        return true;
      }
      tubeIndex = 3;
    } else {
      upVector.v = sdkPerpVector(normal.v);
      tubeIndex = 2;
    }
    if (!numberArray(args[tubeIndex], tubeParams)
      || !numberArray(args[tubeIndex + 1], ductPosition)
      || !numberArray(args[tubeIndex + 2], ductParams)
      || !asInt(args[tubeIndex + 3], complexity)) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeIntersection array arguments could not be evaluated'));
      return true;
    }
    if (!validDirection(normal.v) || !validDirection(upVector.v)
      || tubeParams.length < 3 || ductPosition.length < 2 || ductParams.length < 3
      || tubeParams[0] <= 0.0 || tubeParams[1] <= 0.0
      || Math.abs(tubeParams[2]) <= kEps || ductParams[0] <= 0.0
      || ductParams[1] <= 0.0 || Math.abs(ductParams[2]) <= kEps || complexity.v < 1) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeIntersection has invalid dimensions, vectors or complexity'));
      return true;
    }

    const halfWidth = ductParams[0] * 0.5, halfHeight = ductParams[1] * 0.5;
    // Only cut the tube after confirming that the complete rectangular
    // opening lies on it and its outer end is beyond the B radius (SDK rule).
    if (tubeParams[2] <= kEps || ductPosition[0] - halfWidth < -kEps
      || ductPosition[0] + halfWidth > tubeParams[2] + kEps
      || Math.abs(ductPosition[1]) + halfHeight > tubeParams[0] * 0.5 + kEps
      || Math.abs(ductParams[2]) <= tubeParams[1] * 0.5 + kEps) {
      scene.warnings.push(warningFor(call,
        'makeRectToTubeIntersection opening must lie within the main tube and ductLength must extend beyond diamB/2'));
      return true;
    }
    const [mainTube, duct] = buildRectTubeIntersectionMeshes(
      context, start.v, normal.v, upVector.v,
      tubeParams[0], tubeParams[1], tubeParams[2],
      ductPosition[0], ductPosition[1], ductParams[0], ductParams[1], ductParams[2], complexity.v);
    push(mainTube);
    push(duct);
    return true;
  }

  // Documented derived circular primitives reuse the section-tube and
  // torus mesh builders while preserving the SDK distinction between position
  // (center points) and orientation (normal/up/radius vectors).
  if (call.name === 'makeStraightTube' && args.length >= 4) {
    const centers: FdPoint3d[] = [];
    const diams: number[] = [];
    const n = ref(0), numOfSegs = ref(0);
    const segment = ref(true);
    if (!pointArray(args[0], centers) || !numberArray(args[1], diams)
      || !asInt(args[2], n) || !asInt(args[3], numOfSegs)
      || (args.length > 4 && !asBool(args[4], segment))) return false;
    const sections = stdMax(0, numOfSegs.v) + 1;
    if (numOfSegs.v < 1 || n.v < 1 || centers.length < sections || diams.length < sections) return false;

    let axis = toVec(centers[1]).sub(toVec(centers[0]));
    if (length(axis) <= kEps) axis = new DVec3(1, 0, 0);
    const normal = toFdVector(normalized(axis));
    const up = sdkPerpVector(normal);
    const normals = new Array<FdVector3d>(sections).fill(normal), ups = new Array<FdVector3d>(sections).fill(up);
    const diameters: number[][] = [];
    for (let i = 0; i < sections; ++i) diameters[i] = [diams[i], diams[i]];
    push(buildSectionTubeMesh(context, centers, normals, ups, diameters, n.v, numOfSegs.v, false, segment.v));
    return true;
  }

  if (call.name === 'makeUniVectorTube' && args.length >= 5) {
    const centers: FdPoint3d[] = [];
    const normal = ref(new FdVector3d());
    const diams: number[] = [];
    const n = ref(0), numOfSegs = ref(0);
    const segment = ref(true);
    if (!pointArray(args[0], centers) || !asVector(args[1], normal)
      || !numberArray(args[2], diams) || !asInt(args[3], n)
      || !asInt(args[4], numOfSegs)
      || (args.length > 5 && !asBool(args[5], segment))) return false;
    const sections = stdMax(0, numOfSegs.v) + 1;
    if (numOfSegs.v < 1 || n.v < 1 || !validDirection(normal.v)
      || centers.length < sections || diams.length < sections) return false;
    const up = sdkPerpVector(normal.v);
    const normals = new Array<FdVector3d>(sections).fill(normal.v), ups = new Array<FdVector3d>(sections).fill(up);
    const diameters: number[][] = [];
    for (let i = 0; i < sections; ++i) diameters[i] = [diams[i], diams[i]];
    push(buildSectionTubeMesh(context, centers, normals, ups, diameters, n.v, numOfSegs.v, false, segment.v));
    return true;
  }

  if (call.name === 'makeTubularBend' && args.length >= 8) {
    const center = ref(new FdPoint3d()); const normal = ref(new FdVector3d()), radiusVector = ref(new FdVector3d());
    const radius = ref(0.0), diameter = ref(0.0), sweep = ref(0.0);
    const n = ref(0), segmentation = ref(0); const segment = ref(true), half = ref(false);
    if (!asPoint(args[0], center) || !asVector(args[1], normal)
      || !asVector(args[2], radiusVector) || !asNumber(args[3], radius)
      || !asNumber(args[4], diameter) || !asNumber(args[5], sweep)
      || !asInt(args[6], n) || !asInt(args[7], segmentation)
      || (args.length > 8 && !asBool(args[8], segment))
      || (args.length > 9 && !asBool(args[9], half))) return false;
    if (half.v) return false; // half cross-section needs its own documented topology.
    if (!validDirection(normal.v) || !validDirection(radiusVector.v) || radius.v < 0.0
      || diameter.v <= 0.0 || n.v < 1 || segmentation.v < 1 || Math.abs(sweep.v) <= kEps) return false;
    void segment; // mesh partitioning does not change the geometric surface.
    push(buildTorusSectionMesh(context, center.v, normal.v, radiusVector.v, radius.v, diameter.v, sweep.v, n.v, segmentation.v));
    return true;
  }
  if (call.name === 'makeConnector') {
    const center = ref(new FdPoint3d());
    const normal = ref(new FdVector3d());
    if (args.length < 4 || !asPoint(args[0], center) || !asVector(args[1], normal))
      return false;

    const up = ref(new FdVector3d());
    const width = ref(0.0), height = ref(0.0); let frameWidth = 30.0;
    if (args.length >= 5 && asVector(args[2], up)) {
      if (!asNumber(args[3], width) || !asNumber(args[4], height)) return false;
      if (args.length >= 6) {
        const supplied = ref(0.0);
        if (asNumber(args[5], supplied) && supplied.v > 0.0) frameWidth = supplied.v;
      }
    } else {
      if (!asNumber(args[2], width) || !asNumber(args[3], height)) return false;
      // This overload follows the SDK rule: omitted upVector is
      // vector.perpVector(). Use the same deterministic implementation
      // as GeometryRuntime.
      up.v = sdkPerpVector(normal.v);
    }
    if (!validDirection(normal.v) || !validDirection(up.v) || width.v <= 0.0 || height.v <= 0.0) return false;

    const connector = buildConnectorSleeveMesh(
      context, center.v, normal.v, up.v, width.v, height.v, frameWidth, 0, 1.0);
    push(connector);
    return true;
  }

  // No shape is invented for an API that has no documented adapter.
  // The caller will report it as unsupported instead of showing misleading mesh.
  return false;
}

// } // namespace

export class PreviewGeometryEngine {
  /** SDK calls are decoded and tessellated by internal builders. */
  build(result: RuntimeResult): PreviewGeometryScene {
    const scene: PreviewGeometryScene = { meshes: [], warnings: [] };
    let currentColor: PreviewColor = defaultPreviewColor();
    let currentTransform = identityMatrix();
    const transformByApi = new Map<number, DMat4>();

    for (let i = 0; i < result.apiCalls.length; ++i) {
      const call = result.apiCalls[i];
      const apiIndex = i;
      const args = effectiveArguments(call);

      if (call.name === 'preTransformMesh' || call.name === 'postTransformMesh') {
        let delta = identityMatrix();
        let ok = false;
        if (args.length === 1) {
          const translation = ref(new FdVector3d());
          if (asVector(args[0], translation)) { delta = translationMatrix(translation.v); ok = true; }
        } else if (args.length === 2) {
          const angle = ref(0.0); const axis = ref(new FdVector3d());
          if (asNumber(args[0], angle) && asVector(args[1], axis) && validDirection(axis.v)) {
            delta = rotationMatrix(angle.v, axis.v); ok = true;
          }
        }
        if (!ok) scene.warnings.push(warningFor(call, 'invalid mesh transform arguments'));
        else if (call.name === 'preTransformMesh') currentTransform = multiply(delta, currentTransform);
        else currentTransform = multiply(currentTransform, delta);
        continue;
      }

      if (call.name === 'setPrimitiveMode') continue;
      transformByApi.set(apiIndex, currentTransform);

      if (call.name === 'setMeshColor') {
        if (args.length === 3) {
          const r = ref(0.0), g = ref(0.0), b = ref(0.0);
          if (asNumber(args[0], r) && asNumber(args[1], g) && asNumber(args[2], b))
            currentColor = { r: colorComponent(r.v), g: colorComponent(g.v), b: colorComponent(b.v) };
          else
            scene.warnings.push(warningFor(call, 'RGB arguments are not numeric'));
        } else if (args.length === 1) {
          const index = ref(0);
          if (asInt(args[0], index)) currentColor = acadIndexColor(index.v);
          else scene.warnings.push(warningFor(call, 'color-index argument is not numeric'));
        } else {
          scene.warnings.push(warningFor(call, 'unsupported setMeshColor overload'));
        }
        continue;
      }

      const context = new MeshBuildContext(call, apiIndex, currentColor);

      if (appendPrimitiveApiMeshes(scene, context, args)
        || appendCompositeApiMeshes(scene, context, args))
        continue;

      if (!call.userFunctionCall) {
        const sig = apiSignatureMetadataForCall(call);
        if (sig) {
          const h = sig.sourceHeader;
          const geometryApi = h === 'PnGeometry3d.h' || h === 'GeoCache3dInt.h'
            || h === 'SymbolsInt.h' || h === 'GrillsInt.h' || h === 'TubularPrimitivesInt.h'
            || h === 'RectangularPrimitivesInt.h' || h === 'VascoPrimitivesInt.h' || h === 'BowlPrimitivesInt.h';
          if (geometryApi && (startsWith(call.name, 'make') || startsWith(call.name, 'add') || startsWith(call.name, 'draw')))
            scene.warnings.push(warningFor(call, 'preview adapter not implemented; no substitute mesh was generated'));
        }
      }
    }

    for (const mesh of scene.meshes) {
      const it = transformByApi.get(mesh.apiIndex);
      if (it !== undefined) applyTransform(mesh, it);
    }
    return scene;
  }
}
