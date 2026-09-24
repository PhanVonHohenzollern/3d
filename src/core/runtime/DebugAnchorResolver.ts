import { apiParameterMetadataForCall, type ApiParameterMetadata } from './ApiMetadata';
import { apiParameterRole, apiSemanticsForCall, apiUsedElementCount } from './ApiSemantics';
import type { FdPoint3d, FdVector3d } from './FdMath';
import type { RuntimeApiCall } from './RuntimeTypes';
import { isArray, isPoint, isVector, type RuntimeValue } from './RuntimeValue';

export interface DebugPointSnapshot {
  name: string;
  point: FdPoint3d;
  role: string;
}

export interface DebugVectorAnchor {
  sourceName: string;
  parameterName: string;
  anchor: FdPoint3d;
  direction: FdVector3d;
  role: string;
}

interface Element {
  name: string;
  value: RuntimeValue;
  indices: number[];
}

function elements(call: RuntimeApiCall, argument: number, label: string): Element[] {
  const out: Element[] = [];
  if (argument >= call.arguments.length) return out;
  const semantics = apiSemanticsForCall(call);

  const visit = (value: RuntimeValue, name: string, indices: number[]) => {
    if (indices.length > 4) return;
    if (isArray(value)) {
      let count = value.elements.length;
      if (indices.length === 0 && argument < semantics.length)
        count = apiUsedElementCount(call, semantics[argument], count);
      for (let i = 0; i < count; ++i) visit(value.elements[i], `${name}[${i}]`, [...indices, i]);
    } else {
      out.push({ name, value, indices });
    }
  };

  visit(call.arguments[argument], label, []);

  return out;
}

function parameters(call: RuntimeApiCall): ApiParameterMetadata[] {
  if (!call.userFunctionCall) return apiParameterMetadataForCall(call);

  return call.formalParameterNames.map((name) => ({ name, type: '', defaultValue: '' }));
}

function parameterIndex(params: readonly ApiParameterMetadata[], name: string): number {
  return params.findIndex((p) => p.name === name);
}

export function resolveDebugPointSnapshots(call: RuntimeApiCall): DebugPointSnapshot[] {
  const result: DebugPointSnapshot[] = [];
  const metadata = parameters(call);
  const semantics = apiSemanticsForCall(call);
  for (let i = 0; i < Math.min(metadata.length, call.arguments.length); ++i) {
    if (i < semantics.length && semantics[i].output) continue;
    for (const e of elements(call, i, metadata[i].name))
      if (isPoint(e.value)) result.push({ name: e.name, point: e.value, role: apiParameterRole(call, i, e.indices) });
  }

  return result;
}

export function resolveDebugVectorAnchors(call: RuntimeApiCall): DebugVectorAnchor[] {
  const result: DebugVectorAnchor[] = [];
  const metadata = parameters(call);
  const semantics = apiSemanticsForCall(call);
  for (let i = 0; i < Math.min(semantics.length, call.arguments.length); ++i) {
    const s = semantics[i];
    if (s.anchorBinding === 'None' || s.output) continue;
    const anchorIndex = parameterIndex(metadata, s.anchorParameter);
    if (anchorIndex < 0) continue;
    const points: FdPoint3d[] = [];
    for (const e of elements(call, anchorIndex, s.anchorParameter)) if (isPoint(e.value)) points.push(e.value);
    if (points.length === 0) continue;
    const vectors = elements(call, i, metadata[i].name);
    const source = i < call.argumentExpressions.length ? call.argumentExpressions[i] : metadata[i].name;
    for (let j = 0; j < vectors.length; ++j) {
      const e = vectors[j];
      if (!isVector(e.value)) continue;
      const direction = e.value;
      let sourceName = source;
      for (const index of e.indices) sourceName += `[${index}]`;

      const add = (index: number) => {
        result.push({
          sourceName,
          parameterName: e.name,
          anchor: points[index],
          direction,
          role: apiParameterRole(call, i, e.indices),
        });
      };

      if (s.anchorBinding === 'EveryPoint') for (let k = 0; k < points.length; ++k) add(k);
      else if (s.anchorBinding === 'SameIndex') {
        if (j < points.length) add(j);
      } else add(s.anchorBinding === 'Last' ? points.length - 1 : 0);
    }
  }

  return result;
}
