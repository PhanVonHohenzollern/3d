// Port of runtime/DebugAnchorResolver.{h,cpp}.

import { apiParameterMetadataForCall, type ApiParameterMetadata } from './ApiMetadata';
import { apiParameterRole, apiSemanticsForCall, apiUsedElementCount } from './ApiSemantics';
import type { FdPoint3d, FdVector3d } from './FdMath';
import type { RuntimeApiCall } from './RuntimeTypes';
import { isArray, isPoint, isVector, type RuntimeValue } from './RuntimeValue';

export interface DebugPointSnapshot {
  /** Formal API parameter name (arrays are expanded as name[index]). */
  name: string;
  point: FdPoint3d;
  role: string;
}

export interface DebugVectorAnchor {
  /** Source variable/expression name used only to associate the Variables overlay with this API usage. */
  sourceName: string;
  /** Formal API parameter name shown by API Focus. */
  parameterName: string;
  anchor: FdPoint3d;
  /** Direction and anchor come from the same immutable API-call snapshot. */
  direction: FdVector3d;
  role: string;
}

interface Element { name: string; value: RuntimeValue; indices: number[] }

function elements(call: RuntimeApiCall, argument: number, label: string): Element[] {
  const out: Element[] = [];
  if (argument >= call.arguments.length) return out;
  const semantics = apiSemanticsForCall(call);
  const visit = (value: RuntimeValue, name: string, indices: number[]) => {
    if (indices.length > 4) return;
    if (isArray(value)) {
      let count = value.elements.length;
      if (indices.length === 0 && argument < semantics.length) count = apiUsedElementCount(call, semantics[argument], count);
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

/**
 * Real input points from one immutable API-call snapshot, limited by the
 * documented count; spare array capacity and output arguments are excluded.
 * Expressions such as points[i] are still resolved to the concrete value used
 * by that particular loop iteration.
 */
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

/**
 * Resolves where an API input vector should be displayed.
 *
 * Point values remain the geometry positions. Vector values are local-frame
 * directions (normal/up/radius/direction) and are anchored to the matching
 * point input only for visualization. The resolver uses matched API parameter
 * metadata plus evaluated argument structure; it never changes mesh geometry.
 * Explicit per-overload relationships determine the anchor and index binding.
 * Unmapped vectors stay unanchored instead of guessing from names/array sizes.
 */
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
        result.push({ sourceName, parameterName: e.name, anchor: points[index], direction, role: apiParameterRole(call, i, e.indices) });
      };
      if (s.anchorBinding === 'EveryPoint') for (let k = 0; k < points.length; ++k) add(k);
      else if (s.anchorBinding === 'SameIndex') { if (j < points.length) add(j); }
      else add(s.anchorBinding === 'Last' ? points.length - 1 : 0);
    }
  }
  return result;
}
