import { describe, expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';

function run(lines: string[]) {
  const runtime = new GeometryRuntime();
  const source = lines.join('\n');
  const result = runtime.executeUpToLine(source, lines.length, true);

  return { runtime, result };
}

describe('expression evaluation order', () => {
  it('runs a call that comes before a syntax error in the same expression', () => {
    const { runtime, result } = run([
      'double x = 0;',
      'double g() { x = 5; return 1; }',
      'double y = 0;',
      'y = g() + ;',
    ]);
    expect(runtime.evaluateNumericExpression('x')).toBe(5);
    expect(result.diagnostics.map((d) => d.message)).toEqual(['expected expression']);
  });

  it('reports a syntax error in a branch that short-circuiting skips', () => {
    const { result } = run(['double a = 0;', 'double b = a && (1 + );']);
    expect(result.diagnostics.map((d) => d.message)).toEqual(["expected expression near ')'"]);
  });

  it('does not evaluate the branch that short-circuiting skips', () => {
    const { runtime, result } = run([
      'double x = 0;',
      'double g() { x = 5; return 1; }',
      'double a = 0 && g();',
      'double b = 1 || g();',
      'double c = 1 ? 2 : g();',
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('x')).toBe(0);
    expect(runtime.evaluateNumericExpression('c')).toBe(2);
  });

  it('keeps a mutating method on a path writing to the stored value', () => {
    const { runtime } = run([
      'FdPoint3d points[2];',
      'double z = points[1].set(1, 2, 3).z;',
      'double stored = points[1].y;',
    ]);
    expect(runtime.evaluateNumericExpression('z')).toBe(3);
    expect(runtime.evaluateNumericExpression('stored')).toBe(2);
  });
});
