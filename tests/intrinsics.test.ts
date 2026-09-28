import { describe, expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';

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
