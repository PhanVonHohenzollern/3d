// Hand-built RuntimeResult for the API Trace / Earlier values tests.
//
//   1: double a = 2;
//   2: FdPoint3d p(a, 0, 0);
//   3: FdVector3d n(0, 0, 1);
//   4: a = 3;              (a later write: must not leak into the snapshot)
//   5: helper(p, n, 3.5, pts);
//   6:   inner(p);          (nested user call inside helper)
//   7: FdPoint3d pts[2] = {p, q}; (array argument elements)

import { FdPoint3d, FdVector3d } from '../../src/runtime/FdMath';
import type { RuntimeApiCall, RuntimeResult, RuntimeValueSource, RuntimeVariableChange } from '../../src/runtime/RuntimeTypes';
import { RuntimeArray } from '../../src/runtime/RuntimeValue';

export const p = new FdPoint3d(2, 0, 0);
export const q = new FdPoint3d(1, 1, 0);
export const n = new FdVector3d(0, 0, 1);

const aSource: RuntimeValueSource = { name: 'a', value: 2, variableId: 1, historyEnd: 1 };
const pSource: RuntimeValueSource = { name: 'p', value: p, variableId: 2, historyEnd: 2 };
const nSource: RuntimeValueSource = { name: 'n', value: n, variableId: 3, historyEnd: 3 };
const qSource: RuntimeValueSource = { name: 'q', value: q, variableId: 5, historyEnd: 6 };

function change(line: number, name: string, operation: string, expression: string, after: RuntimeVariableChange['after'],
  variableId: number, sources: RuntimeValueSource[] = [], before: RuntimeVariableChange['before'] = undefined): RuntimeVariableChange {
  return { line, name, operation, expression, before, after, variableId, sources };
}

export function traceResult(): RuntimeResult {
  const pts = new RuntimeArray('FdPoint3d', [2], [p, q]);
  const variableChanges: RuntimeVariableChange[] = [
    change(1, 'a', 'declare', '2', 2, 1),
    change(2, 'p', 'declare', 'FdPoint3d(a, 0, 0)', p, 2, [aSource]),
    change(3, 'n', 'declare', 'FdVector3d(0, 0, 1)', n, 3),
    change(4, 'a', '=', '3', 3, 1, [], 2),
    change(1, 'q', 'declare', 'FdPoint3d(1, 1, 0)', q, 5),
    change(1, 'q', '+=', 'FdVector3d(0, 0, 0)', q, 5, [{ ...qSource, historyEnd: 5 }], q),
    change(7, 'pts', 'declare', '{p, q}', pts, 6, [pSource, qSource]),
    change(7, 'pts[0]', 'declare', 'p', p, 6, [pSource]),
    change(7, 'pts[1]', 'declare', 'q', q, 6, [qSource]),
  ];
  const helper: RuntimeApiCall = {
    line: 5,
    parentApiIndex: -1,
    userFunctionCall: true,
    name: 'helper',
    arguments: [p, n, 3.5, pts],
    argumentExpressions: ['p', 'n', '3.5', 'pts'],
    formalParameterNames: ['center', 'normal', 'size', 'points'],
    formalParameterTypes: ['FdPoint3d', 'FdVector3d', 'double', 'FdPoint3d*'],
    display: 'helper(p, n, 3.5, pts)',
    argumentTraces: [
      { expression: 'p', sources: [pSource], elements: [] },
      { expression: 'n', sources: [nSource], elements: [] },
      { expression: '3.5', sources: [], elements: [] },
      {
        expression: 'pts',
        sources: [{ name: 'pts', value: pts, variableId: 6, historyEnd: 9 }],
        elements: [
          { expression: 'pts[0]', sources: [{ name: 'pts[0]', value: p, variableId: 6, historyEnd: 9 }], elements: [] },
          { expression: 'pts[1]', sources: [{ name: 'pts[1]', value: q, variableId: 6, historyEnd: 9 }], elements: [] },
        ],
      },
    ],
  };
  const inner: RuntimeApiCall = {
    line: 6,
    parentApiIndex: 0,
    userFunctionCall: true,
    name: 'inner',
    arguments: [p],
    argumentExpressions: ['c'],
    formalParameterNames: ['c'],
    formalParameterTypes: ['FdPoint3d'],
    display: 'inner(c)',
    argumentTraces: [{ expression: 'c', sources: [{ name: 'c', value: p, variableId: 2, historyEnd: 2 }], elements: [] }],
  };
  return {
    variables: [
      { name: 'a', value: 3, lastChangedLine: 4 },
      { name: 'p', value: p, lastChangedLine: 2 },
      { name: 'n', value: n, lastChangedLine: 3 },
    ],
    variableChanges,
    diagnostics: [],
    apiCalls: [helper, inner],
    parameterRequests: [],
  };
}
