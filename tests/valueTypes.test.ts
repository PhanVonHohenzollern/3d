import { describe, expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import { runtimeTypeName } from '@engine/runtime/RuntimeValue';
import { kValueTypeNames, valueTypeConstructedBy, valueTypeNamed } from '@engine/runtime/values/registry';

describe('value type registry', () => {
  it('gives every type a default value that reports the type name', () => {
    for (const name of kValueTypeNames) {
      const type = valueTypeNamed(name)!;
      expect(runtimeTypeName(type.create())).toBe(name);
      for (const alias of type.constructorNames) expect(valueTypeConstructedBy(alias)).toBe(type);
    }
  });

  it('reads and assigns std::vector front() and back() through the same element', () => {
    const runtime = new GeometryRuntime();
    const source = [
      'std::vector<FdPoint3d> points;',
      'points.push_back(FdPoint3d(1, 2, 3));',
      'points.push_back(FdPoint3d(4, 5, 6));',
      'points.front().x = 10;',
      'points.back() = FdPoint3d(7, 8, 9);',
      'double first = points.front().x;',
      'double last = points.back().z;',
    ].join('\n');
    const result = runtime.executeUpToLine(source, 7, true);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('first')).toBe(10);
    expect(runtime.evaluateNumericExpression('last')).toBe(9);
  });
});
