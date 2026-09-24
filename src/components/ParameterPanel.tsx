import { Plus, RotateCcw } from 'lucide-react';
import { useParameterPanel } from '../hooks/useParameterPanel';
import type { ParameterPanelProps } from '../types/panels';
import { Button } from './ui/button';
import { EditableComboBox } from './ui/EditableComboBox';
import { FloatingWindow } from './ui/FloatingWindow';
import { Input } from './ui/input';

export function ParameterPanel(props: ParameterPanelProps) {
  const panel = useParameterPanel(props);
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
      </div>
      {dialog && (
        <FloatingWindow title="Parameter table" raiseSerial={0} onClose={dialog.close}>
          <label className="flex shrink-0 flex-col gap-1 text-xs">
            Paste a table with parameter names in the first row.
            <textarea
              aria-label="Table to preview"
              rows={3}
              className="w-full resize-y rounded border border-input bg-base p-2 font-code text-xs select-text"
              placeholder="Paste your cells here, then edit the preview below."
              value={dialog.text}
              onChange={(event) => dialog.setText(event.target.value)}
              onPaste={(event) => event.stopPropagation()}
            />
          </label>
          <div className="flex shrink-0 items-center justify-between text-xs">
            <span className="font-semibold">Preview</span>
            <span className="text-muted-foreground">Edit column names and values before applying.</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded border border-line">
            {dialog.cells.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Your pasted table will appear here.</p>
            ) : (
              <table aria-label="Parameter table preview" className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-base">
                  <tr>
                    <th scope="col" className="border-b border-line px-2 text-muted-foreground">
                      Row
                    </th>
                    {Array.from({ length: dialog.columnCount }, (_, column) => (
                      <th key={column} scope="col" className="min-w-28 border-b border-line p-1">
                        <Input
                          aria-label={`Column ${column + 1} name`}
                          className="h-8 font-semibold md:text-xs"
                          value={dialog.cells[0][column] ?? ''}
                          onChange={(event) => dialog.editCell(0, column, event.target.value)}
                          onPaste={(event) => event.stopPropagation()}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dialog.cells.slice(1).map((row, index) => (
                    <tr key={index}>
                      <th scope="row" className="px-2 font-normal text-muted-foreground">
                        {index + 1}
                      </th>
                      {Array.from({ length: dialog.columnCount }, (_, column) => (
                        <td key={column} className="p-1">
                          <Input
                            aria-label={`Row ${index + 1}, ${dialog.cells[0][column] || `column ${column + 1}`}`}
                            className="h-8 font-code md:text-xs"
                            value={row[column] ?? ''}
                            onChange={(event) => dialog.editCell(index + 1, column, event.target.value)}
                            onPaste={(event) => event.stopPropagation()}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p
            role={dialog.error ? 'alert' : 'status'}
            className={`shrink-0 text-xs ${dialog.error ? 'text-error' : 'text-muted-foreground'}`}
          >
            {dialog.error || dialog.summary || 'Parameters update only after Apply.'}
          </p>
          <div className="flex shrink-0 justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={dialog.close}>
              Cancel
            </Button>
            <Button size="sm" disabled={!dialog.canApply} onClick={dialog.apply}>
              Apply
            </Button>
          </div>
        </FloatingWindow>
      )}
      {panel.pasteMessage && (
        <p
          role={panel.pasteIsError ? 'alert' : 'status'}
          className={`shrink-0 px-3 py-1 text-[11px] ${panel.pasteIsError ? 'text-error' : 'text-muted-foreground'}`}
        >
          {panel.pasteMessage}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {panel.fields.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Add get_val parameters in the editor, then Build or Debug to edit their values here.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-base text-muted-foreground">
              <tr>
                {['Parameter', 'Value', 'Variable', 'Line'].map((title) => (
                  <th key={title} className="border-b border-line px-3 py-1.5 font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {panel.fields.map((field) => (
                <tr key={field.key} className="border-b border-line/50">
                  <th className="px-3 py-1 font-medium">{field.label}</th>
                  <td className="min-w-36 px-2 py-1">
                    <EditableComboBox
                      label={field.label}
                      compact
                      value={field.value}
                      items={field.options.map((option) => `${option.value} · Row ${option.row + 1}`)}
                      selectedIndex={field.options.findIndex((option) => option.row === field.selectedDataSet)}
                      onItemSelected={(index) => field.selectDataSet(field.options[index].row)}
                      onTextChanged={field.change}
                      onFocus={field.beginEdit}
                      onBlur={field.commit}
                      onKeyDown={field.onKeyDown}
                    />
                  </td>
                  <td className="px-3 py-1 font-code text-[11px] text-muted-foreground">{field.description}</td>
                  <td className="px-3 py-1 font-code text-[11px] text-muted-foreground">{field.line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
