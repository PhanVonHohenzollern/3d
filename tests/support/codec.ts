import { FdPoint3d, FdVector3d } from '../../src/core/runtime/FdMath';
import type {
  RuntimeApiCall,
  RuntimeArgumentTrace,
  RuntimeParameterRequest,
  RuntimeResult,
  RuntimeValueSource,
} from '../../src/core/runtime/RuntimeTypes';
import {
  RuntimeArray,
  runtimeTypeName,
  runtimeValueToString,
  type RuntimeValue,
} from '../../src/core/runtime/RuntimeValue';
import type { PreviewGeometryScene, PreviewMesh } from '../../src/core/geometry/PreviewGeometryEngine';
import type { ConnectorPreview } from '../../src/core/geometry/ConnectorPreview';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = any;

export function encodeNumber(v: number): Json {
  if (Number.isNaN(v)) return 'nan';
  if (!Number.isFinite(v)) return v < 0 ? '-inf' : 'inf';
  return v;
}

const xyz = (p: { x: number; y: number; z: number }) => [encodeNumber(p.x), encodeNumber(p.y), encodeNumber(p.z)];

export function encodeValue(v: RuntimeValue): Json {
  if (v === undefined) return { t: 'unset' };
  if (typeof v === 'number') return { t: 'd', v: encodeNumber(v) };
  if (typeof v === 'bigint') return { t: 'i', v: v.toString() };
  if (typeof v === 'boolean') return { t: 'b', v };
  if (typeof v === 'string') return { t: 's', v };
  if (v instanceof FdPoint3d) return { t: 'p', v: xyz(v) };
  if (v instanceof FdVector3d) return { t: 'v', v: xyz(v) };
  if (v instanceof RuntimeArray)
    return { t: 'a', elementType: v.elementType, dimensions: [...v.dimensions], elements: v.elements.map(encodeValue) };
  throw new Error(`not a RuntimeValue: ${String(v)}`);
}

export function encodeSource(s: RuntimeValueSource): Json {
  return { name: s.name, value: encodeValue(s.value), variableId: s.variableId, historyEnd: s.historyEnd };
}

export function encodeTrace(t: RuntimeArgumentTrace): Json {
  return { expression: t.expression, sources: t.sources.map(encodeSource), elements: t.elements.map(encodeTrace) };
}

export function encodeParameterRequest(r: RuntimeParameterRequest): Json {
  return {
    name: r.name,
    type: r.type,
    defaultValue: r.defaultValue,
    currentValue: r.currentValue,
    sourceFunction: r.sourceFunction,
    variableName: r.variableName,
    line: r.line,
  };
}

export function encodeApiCall(c: RuntimeApiCall): Json {
  return {
    line: c.line,
    parentApiIndex: c.parentApiIndex,
    userFunctionCall: c.userFunctionCall,
    name: c.name,
    arguments: c.arguments.map(encodeValue),
    argumentTexts: c.arguments.map(runtimeValueToString),
    argumentTypes: c.arguments.map(runtimeTypeName),
    argumentExpressions: [...c.argumentExpressions],
    formalParameterNames: [...c.formalParameterNames],
    formalParameterTypes: [...c.formalParameterTypes],
    display: c.display,
    argumentTraces: c.argumentTraces.map(encodeTrace),
  };
}

export function encodeResult(r: RuntimeResult): Json {
  return {
    variables: r.variables.map((v) => ({
      name: v.name,
      value: encodeValue(v.value),
      text: runtimeValueToString(v.value),
      type: runtimeTypeName(v.value),
      lastChangedLine: v.lastChangedLine,
    })),
    variableChanges: r.variableChanges.map((c) => ({
      line: c.line,
      name: c.name,
      operation: c.operation,
      expression: c.expression,
      before: encodeValue(c.before),
      after: encodeValue(c.after),
      variableId: c.variableId,
      sources: c.sources.map(encodeSource),
    })),
    diagnostics: r.diagnostics.map((d) => ({ line: d.line, message: d.message })),
    apiCalls: r.apiCalls.map(encodeApiCall),
    parameterRequests: r.parameterRequests.map(encodeParameterRequest),
  };
}

export function encodeMesh(m: PreviewMesh): Json {
  const vertices: Json[] = [];
  for (const v of m.vertices) vertices.push(v.x, v.y, v.z, v.nx, v.ny, v.nz);
  return {
    apiIndex: m.apiIndex,
    sourceLine: m.sourceLine,
    apiName: m.apiName,
    color: [m.color.r, m.color.g, m.color.b].map(encodeNumber),
    vertices: vertices.map(encodeNumber),
    indices: [...m.indices],
  };
}

export function encodeScene(s: PreviewGeometryScene): Json {
  return { meshes: s.meshes.map(encodeMesh), warnings: [...s.warnings] };
}

export function encodeConnector(c: ConnectorPreview): Json {
  return {
    id: c.id,
    name: c.name,
    pointName: c.pointName,
    point: xyz(c.point),
    direction: xyz(c.direction),
    up: xyz(c.up),
    length: encodeNumber(c.length),
    meshes: c.meshes.map(encodeMesh),
    outline: c.outline.map(([a, b]) => [xyz(a), xyz(b)]),
  };
}

function decodeNumber(v: Json): number {
  if (v === 'nan') return NaN;
  if (v === 'inf') return Infinity;
  if (v === '-inf') return -Infinity;
  return v;
}

export function decodeValue(j: Json): RuntimeValue {
  switch (j.t) {
    case 'unset':
      return undefined;
    case 'd':
      return decodeNumber(j.v);
    case 'i':
      return BigInt(j.v);
    case 'b':
      return j.v;
    case 's':
      return j.v;
    case 'p':
      return new FdPoint3d(decodeNumber(j.v[0]), decodeNumber(j.v[1]), decodeNumber(j.v[2]));
    case 'v':
      return new FdVector3d(decodeNumber(j.v[0]), decodeNumber(j.v[1]), decodeNumber(j.v[2]));
    case 'a':
      if (j.null) throw new Error('null RuntimeArrayPtr is not representable');
      return new RuntimeArray(j.elementType, [...j.dimensions], j.elements.map(decodeValue));
    default:
      throw new Error(`bad encoded value ${JSON.stringify(j)}`);
  }
}

const decodeSource = (s: Json): RuntimeValueSource => ({
  name: s.name,
  value: decodeValue(s.value),
  variableId: s.variableId,
  historyEnd: s.historyEnd,
});

const decodeTrace = (t: Json): RuntimeArgumentTrace => ({
  expression: t.expression,
  sources: t.sources.map(decodeSource),
  elements: t.elements.map(decodeTrace),
});

export function decodeApiCall(c: Json): RuntimeApiCall {
  return {
    line: c.line,
    parentApiIndex: c.parentApiIndex,
    userFunctionCall: c.userFunctionCall,
    name: c.name,
    arguments: c.arguments.map(decodeValue),
    argumentExpressions: [...c.argumentExpressions],
    formalParameterNames: [...c.formalParameterNames],
    formalParameterTypes: [...c.formalParameterTypes],
    display: c.display,
    argumentTraces: c.argumentTraces.map(decodeTrace),
  };
}

export function decodeResult(r: Json): RuntimeResult {
  return {
    variables: r.variables.map((v: Json) => ({
      name: v.name,
      value: decodeValue(v.value),
      lastChangedLine: v.lastChangedLine,
    })),
    variableChanges: r.variableChanges.map((c: Json) => ({
      line: c.line,
      name: c.name,
      operation: c.operation,
      expression: c.expression,
      before: decodeValue(c.before),
      after: decodeValue(c.after),
      variableId: c.variableId,
      sources: c.sources.map(decodeSource),
    })),
    diagnostics: r.diagnostics.map((d: Json) => ({ line: d.line, message: d.message })),
    apiCalls: r.apiCalls.map(decodeApiCall),
    parameterRequests: r.parameterRequests.map((p: Json) => ({ ...p })),
  };
}
