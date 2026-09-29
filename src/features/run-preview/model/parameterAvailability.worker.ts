import { GeometryRuntime, parameterKey, type RuntimeExecutionOptions } from '@engine/runtime';

export interface AvailabilityRequest {
  id: number;
  source: string;
  options: RuntimeExecutionOptions;
  parameters: ReadonlyMap<string, string>;
}

export interface AvailabilityResponse {
  id: number;
  keys: string[] | null;
}

const runtime = new GeometryRuntime();

self.onmessage = ({ data }: MessageEvent<AvailabilityRequest>) => {
  let keys: string[] | null = null;
  try {
    runtime.setParameters(data.parameters);
    const result = runtime.executeUpToLine(data.source, data.source.split('\n').length, true, data.options);
    keys = [...new Set(result.parameterRequests.map(parameterKey))];
  } catch {
    // Keep inputs editable if availability fails; Build reports execution errors.
  }
  self.postMessage({ id: data.id, keys } satisfies AvailabilityResponse);
};
