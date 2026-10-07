import { describe, expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import { FdPoint3d } from '@engine/runtime/FdMath';
import { lineIntersection } from '@engine/runtime/helpers/lineIntersection';

function run(source: string, parameters: [string, string][] = []) {
  const runtime = new GeometryRuntime();
  runtime.setParameters(new Map(parameters));
  const result = runtime.executeUpToLine(source, source.split('\n').length, true);

  return { runtime, result };
}

describe('runtime intrinsics', () => {
  it('lets a program function replace an SDK intrinsic such as setpt', () => {
    const { runtime, result } = run(
      ['double calls = 0;', 'void setpt(double a, double b) { calls = calls + a + b; }', 'setpt(1, 2);'].join('\n'),
    );
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('calls')).toBe(3);
  });

  it('never lets a program function replace get_val', () => {
    const { runtime } = run(
      ['double w = 1;', 'void get_val(const char* name, double value) { w = -1; }', 'get_val("W", w);'].join('\n'),
      [['W', '5']],
    );
    expect(runtime.evaluateNumericExpression('w')).toBe(5);
  });

  it('runs the same intrinsics while running and when scanning the source', () => {
    const source = ['double w = 2;', 'double t = 0;', 'get_val("W", w);', 'if (getExtInsSize(t)) w = w + t;'].join(
      '\n',
    );
    const runtime = new GeometryRuntime();
    const discovered = runtime.discoverParameters(source).map((request) => request.sourceFunction);
    const { result } = run(source);
    expect(discovered).toEqual(['get_val', 'getExtInsSize']);
    expect(result.parameterRequests.map((request) => request.sourceFunction)).toEqual(['get_val']);
  });
});

describe('line intersections', () => {
  it.each(['lineSegToLineSegInt', 'lineToLineInt'])(
    'returns a bool and updates references in %s expressions',
    (api) => {
      const { runtime, result } = run(`
bool intersect(FdPoint3d &out) {
  return ${api}(FdPoint3d(0,0,0),FdPoint3d(10,0,0),FdPoint3d(5,-5,0),FdPoint3d(5,5,0),out);
}
void main() {
  FdPoint3d points[2] = {FdPoint3d(-1,-1,-1),FdPoint3d(-2,-2,-2)};
  bool hit = intersect(points[0]);
  int reached = 0;
  if (${api}(FdPoint3d(0,0,0),FdPoint3d(10,0,0),FdPoint3d(10,-5,0),FdPoint3d(10,5,0),points[1])) reached = 1;
  bool skipped = false && intersect(points[1]);
}`);
      expect(result.diagnostics).toEqual([]);
      expect(
        ['hit', 'reached', 'skipped', 'points[0].x', 'points[1].x'].map((s) => runtime.evaluateNumericExpression(s)),
      ).toEqual([1, 1, 0, 5, 10]);
      expect(result.apiCalls.filter((c) => c.name === api)).toHaveLength(2);
      expect(result.variableChanges.some((c) => c.operation === api && c.name === 'points[1]')).toBe(true);
    },
  );

  it('distinguishes segments from extended lines and preserves the output on a miss', () => {
    const { runtime, result } = run(`
FdPoint3d a(0,0,0), b(10,0,0), c(20,-5,0), d(20,5,0), out(7,8,9);
bool miss = lineSegToLineSegInt(a,b,c,d,out);
double before = out.x;
bool hit = lineToLineInt(a,b,c,d,out);
`);
    expect(result.diagnostics).toEqual([]);
    expect(
      ['miss', 'before', 'hit', 'out.x', 'out.y', 'out.z'].map((s) => runtime.evaluateNumericExpression(s)),
    ).toEqual([0, 7, 1, 20, 0, 0]);
  });

  it.each([1e-5, 1, 1e6])('finds a 3D intersection independently of segment length (%s)', (scale) => {
    const p = (x: number, y: number, z: number) => new FdPoint3d(x * scale, y * scale, z * scale);

    const hit = lineIntersection(p(-1, -2, -3), p(1, 2, 3), p(-3, 1, 2), p(3, -1, -2), true);
    expect(hit).not.toBeNull();
    expect(Math.hypot(hit!.x, hit!.y, hit!.z)).toBeLessThan(1e-9 * scale);
  });

  it('handles nearly parallel intersecting segments without dot-product cancellation', () => {
    const hit = lineIntersection(
      new FdPoint3d(),
      new FdPoint3d(1e6, 0, 0),
      new FdPoint3d(0, -0.001, 0),
      new FdPoint3d(1e6, 0.001, 0),
      true,
    );
    expect(hit?.x).toBeCloseTo(500000, 6);
    expect(hit?.y).toBeCloseTo(0, 12);
  });

  it('does not turn long skew segments into an intersection', () => {
    expect(
      lineIntersection(
        new FdPoint3d(-1e6, 0, 0),
        new FdPoint3d(1e6, 0, 0),
        new FdPoint3d(0, -1e6, 0.01),
        new FdPoint3d(0, 1e6, 0.01),
        true,
      ),
    ).toBeNull();
  });

  it.each([
    [new FdPoint3d(), new FdPoint3d(), new FdPoint3d(0, -1, 0), new FdPoint3d(0, 1, 0)],
    [new FdPoint3d(), new FdPoint3d(1, 0, 0), new FdPoint3d(0, 1, 0), new FdPoint3d(1, 1, 0)],
    [new FdPoint3d(), new FdPoint3d(1, 0, 0), new FdPoint3d(2, 0, 0), new FdPoint3d(3, 0, 0)],
    [new FdPoint3d(NaN, 0, 0), new FdPoint3d(1, 0, 0), new FdPoint3d(0, -1, 0), new FdPoint3d(0, 1, 0)],
  ])('does not invent a unique intersection for invalid or parallel inputs', (a, b, c, d) => {
    expect(lineIntersection(a, b, c, d, true)).toBeNull();
  });

  it('keeps the Berliner miss distinct from the following intersection at the origin', () => {
    const { runtime, result } = run(`
FdPoint3d start(-409.6268042533,0,385.3731957466), end(1060250.5449754903,0,-1060274.7985841522);
FdPoint3d origin, innerPeak, outerArcCenter, extended;
bool first = lineSegToLineSegInt(start,end,origin,FdPoint3d(0,0,1500000),innerPeak);
bool extension = lineToLineInt(start,end,origin,FdPoint3d(0,0,1500000),extended);
FdVector3d direction = (start-innerPeak).normal() + (origin-innerPeak).normal();
FdPoint3d partner = innerPeak + direction*1500000;
bool second = lineSegToLineSegInt(FdPoint3d(1500,0,0),FdPoint3d(-1500,0,0),innerPeak,partner,outerArcCenter);
`);
    expect(result.diagnostics).toEqual([]);
    expect(
      ['first', 'extension', 'second', 'innerPeak.z', 'outerArcCenter.z'].map((s) =>
        runtime.evaluateNumericExpression(s),
      ),
    ).toEqual([0, 1, 1, 0, 0]);
    expect(runtime.evaluateNumericExpression('extended.z')).toBeCloseTo(-24.2536085067, 6);
  });
});
