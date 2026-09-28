import { Plus, RotateCcw } from 'lucide-react';
import { useParameterPanel } from '@/features/edit-parameters';
import type { ParameterPanelProps } from '@/features/edit-parameters';
import { Button } from '@/shared/ui/button';
import { EditableComboBox } from '@/shared/ui/editable-combo-box';
import { ParameterTableDialog } from '@/features/edit-parameters';

export function ParameterPanel(props: ParameterPanelProps) {
  const { gridRef, ...panel } = useParameterPanel(props);
  const dialog = panel.tableDialog;

  return (
    <div className="flex h-full min-h-0 flex-col bg-window" onPaste={panel.onPaste}>
      <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1">
        <h3 className="text-xs font-semibold">Parameters</h3>
        <span className="font-code text-[10px]">{panel.fields.length}</span>
        {panel.dataSetCount > 0 && (
          <select
            aria-label="Parameter data row"
            className="rounded border border-input bg-base px-1 text-xs"
            value={panel.dataSetIndex}
            onChange={(event) => panel.selectDataSet(Number(event.target.value))}
          >
            <option value={-1} disabled>
              Custom values
            </option>
            {Array.from({ length: panel.dataSetCount }, (_, index) => (
              <option key={index} value={index}>
                Row {index + 1} / {panel.dataSetCount}
              </option>
            ))}
          </select>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          aria-label="Add parameter table"
          title="Add parameter table"
          aria-haspopup="dialog"
          aria-expanded={!!dialog}
          onClick={panel.openTable}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={panel.fields.length === 0}
          onClick={panel.resetToSource}
        >
          <RotateCcw className="size-3" aria-hidden /> Reset
        </Button>
        <Button
          size="sm"
          className="h-7 px-3 text-[11px]"
          aria-label="Apply parameter values"
          title="Build with these values"
          disabled={panel.fields.length === 0 || !props.onApply}
          onClick={props.onApply}
        >
          OK
        </Button>
      </div>
      {panel.tabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Function parameters"
          className="flex shrink-0 flex-wrap gap-1 border-b border-line px-2 py-1"
        >
          {panel.tabs.map((tab) => (
            <Button
              key={tab.id}
              role="tab"
              aria-selected={panel.activeTab === tab.id}
              variant={panel.activeTab === tab.id ? 'secondary' : 'ghost'}
              size="sm"
              className={`h-7 px-2 text-xs ${tab.enabled ? '' : 'opacity-50'}`}
              title={tab.enabled ? tab.label : `${tab.label}: inactive branch`}
              onClick={() => panel.selectTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      )}
      {dialog && <ParameterTableDialog dialog={dialog} />}
      {panel.pasteMessage && (
        <p
          role={panel.pasteIsError ? 'alert' : 'status'}
          className={`shrink-0 px-3 py-1 text-[11px] ${panel.pasteIsError ? 'text-error' : 'text-muted-foreground'}`}
        >
          {panel.pasteMessage}
        </p>
      )}
      <div ref={gridRef} className="min-h-0 flex-1 overflow-auto p-1">
        {panel.fields.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Add get_val parameters in the editor, then Build or Debug to edit their values here.
          </p>
        ) : (
          <div
            className="grid items-start gap-2"
            style={{ gridTemplateColumns: `repeat(${panel.groups.length}, minmax(0, 1fr))` }}
          >
            {panel.groups.map((group, index) => (
              <table
                key={index}
                aria-label={`Parameters ${index + 1}`}
                className="w-full table-fixed border-collapse text-left text-xs text-foreground"
              >
                <colgroup>
                  <col className="w-[38%]" />
                  <col />
                </colgroup>
                <thead className="bg-base text-muted-foreground">
                  <tr>
                    {['Parameter', 'Value'].map((title) => (
                      <th key={title} className="h-6 border-b border-line px-1 font-medium">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.map((field) => (
                    <tr key={field.key} className={`h-7 border-b border-line/50 ${field.disabled ? 'opacity-50' : ''}`}>
                      <th title={field.label} scope="row" className="truncate px-1 font-medium">
                        {field.label}
                      </th>
                      <td className="px-1 py-0 [&_button]:h-6 [&_input]:h-6 [&_input]:py-0.5">
                        {field.checkbox ? (
                          <input
                            type="checkbox"
                            aria-label={field.label}
                            className="block w-4 cursor-pointer accent-primary"
                            checked={
                              field.value === 'true' ||
                              (Number.isFinite(Number(field.value)) && Number(field.value) !== 0)
                            }
                            disabled={field.disabled}
                            onChange={(event) => field.setChecked(event.target.checked)}
                          />
                        ) : (
                          <EditableComboBox
                            label={field.label}
                            compact
                            value={field.value}
                            disabled={field.disabled}
                            items={field.options.map((option) => `${option.value} · Row ${option.row + 1}`)}
                            selectedIndex={field.options.findIndex((option) => option.row === field.selectedDataSet)}
                            onItemSelected={(index) => field.selectDataSet(field.options[index].row)}
                            onTextChanged={field.change}
                            onFocus={field.beginEdit}
                            onBlur={field.commit}
                            onKeyDown={field.onKeyDown}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
