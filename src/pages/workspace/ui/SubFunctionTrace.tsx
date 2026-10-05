import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/native-select';
import { ApiTracePanel, type ApiTracePanelModel } from '@/widgets/api-trace-panel';

interface SubFunctionTraceProps {
  names: string[];
  active: string;
  occurrence: number;
  calls: { index: number; line: number }[];
  select(name: string): void;
  selectOccurrence(index: number): void;
  model: ApiTracePanelModel;
}

export function SubFunctionTrace({
  names,
  active,
  calls,
  occurrence,
  select,
  selectOccurrence,
  model,
}: SubFunctionTraceProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line p-1">
        <div role="tablist" aria-label="Sub-function API traces" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {names.map((name) => (
            <Button
              key={name}
              role="tab"
              size="xs"
              aria-selected={active === name}
              variant={active === name ? 'secondary' : 'ghost'}
              onClick={() => select(name)}
            >
              {name}
            </Button>
          ))}
        </div>
        {calls.length > 0 && (
          <NativeSelect
            aria-label="Function call"
            size="sm"
            value={occurrence}
            onChange={(event) => selectOccurrence(Number(event.target.value))}
          >
            {calls.map(({ index, line }) => (
              <option key={index} value={index}>
                Call {index + 1} · line {line}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      {active ? (
        <div className="min-h-0 flex-1">
          <ApiTracePanel model={model} />
        </div>
      ) : (
        <p className="p-3 text-xs text-muted-foreground">Select a function to inspect its geometry and arguments.</p>
      )}
    </div>
  );
}
