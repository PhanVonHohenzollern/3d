import type { SourceFunction, FunctionInput } from '@/entities/source-function';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

interface SubParameterPanelProps {
  enabled: boolean;
  functions: (Omit<SourceFunction, 'inputs'> & { inputs: (FunctionInput & { values: string[] })[] })[];
  active: string;
  select: (name: string) => void;
  change: (name: string, parameter: string, initial: string[], index: number, value: string) => void;
  apply: (name: string) => void;
  reset: (name: string) => void;
}

export function SubParameterPanel(props: SubParameterPanelProps) {
  const fn = props.functions.find((fn) => fn.name === props.active);

  return (
    <div className="flex h-full min-h-0 flex-col bg-window text-foreground">
      <div className="flex shrink-0 items-center gap-1 border-b border-line p-1">
        <div role="tablist" aria-label="Sub-function arguments" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {props.functions.map((fn) => (
            <Button
              key={fn.name}
              role="tab"
              disabled={!props.enabled}
              size="xs"
              aria-selected={fn.name === props.active}
              variant={fn.name === props.active ? 'secondary' : 'ghost'}
              onClick={() => props.select(fn.name)}
            >
              {fn.name}
            </Button>
          ))}
        </div>
        <Button size="xs" variant="outline" disabled={!props.enabled || !fn} onClick={() => fn && props.reset(fn.name)}>
          Reset from call
        </Button>
        <Button
          size="xs"
          title="Build function with these arguments"
          disabled={!props.enabled || !fn}
          onClick={() => fn && props.apply(fn.name)}
        >
          OK
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-auto p-2 sm:grid-cols-2 xl:grid-cols-3">
        {fn?.inputs.map((input) => (
          <fieldset
            key={input.name}
            disabled={!props.enabled}
            className="min-w-0 rounded border border-line p-2 disabled:opacity-50"
          >
            <legend className="px-1 text-xs font-medium">
              {input.name} <span className="font-normal text-muted-foreground">{input.type}</span>
            </legend>
            {input.kind === 'array' ? (
              <div className="space-y-2">
                {/\b(bool|BOOL)\b/.test(input.type) && !input.type.match(/\].*\[/) && (
                  <label className="flex items-center gap-2 text-xs">
                    Elements
                    <Input
                      type="number"
                      min={0}
                      max={4096}
                      className="h-7 w-20"
                      aria-label={`${fn.name}.${input.name}.length`}
                      value={
                        input.values[0]
                          .replace(/[{}\s]/g, '')
                          .split(',')
                          .filter(Boolean).length
                      }
                      onChange={(event) => {
                        const count = Math.max(0, Math.min(4096, Math.trunc(Number(event.target.value))));
                        const values = input.values[0]
                          .replace(/[{}]/g, '')
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean);
                        props.change(
                          fn.name,
                          input.name,
                          input.initial,
                          0,
                          `{${Array.from({ length: count }, (_, i) => values[i] ?? 'false').join(', ')}}`,
                        );
                      }}
                    />
                  </label>
                )}
                <textarea
                  aria-label={`${fn.name}.${input.name}`}
                  className="w-full rounded border border-input bg-transparent p-2 font-code text-xs"
                  rows={2}
                  value={input.values[0]}
                  placeholder="{true, false, true, true}"
                  onChange={(event) => props.change(fn.name, input.name, input.initial, 0, event.target.value)}
                />
              </div>
            ) : input.kind === 'unsupported' ? (
              <p className="text-xs text-error">Unsupported preview input type.</p>
            ) : (
              <div className="flex gap-2">
                {input.values.map((value, index) => (
                  <label key={index} className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                    {input.values.length === 3 ? ['X', 'Y', 'Z'][index] : 'Value'}
                    <Input
                      aria-label={`${fn.name}.${input.name}${input.values.length === 3 ? '.' + ['X', 'Y', 'Z'][index] : ''}`}
                      className="mt-1 h-7 px-2 font-code text-foreground md:text-xs"
                      value={value}
                      onChange={(event) => props.change(fn.name, input.name, input.initial, index, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
