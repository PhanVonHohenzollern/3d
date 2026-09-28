import type { ParameterTableDialogState } from '@/features/edit-parameters/model/types';
import { Button } from '@/shared/ui/button';
import { EditableComboBox } from '@/shared/ui/editable-combo-box';
import { FloatingWindow } from '@/shared/ui/floating-window';
import { Input } from '@/shared/ui/input';

type ParameterTableDialogProps = {
  dialog: ParameterTableDialogState;
};

export const ParameterTableDialog = ({ dialog }: ParameterTableDialogProps) => (
  <FloatingWindow title="Parameter table" raiseSerial={0} onClose={dialog.close}>
    <label className="flex shrink-0 flex-col gap-1 text-xs">
      Paste a table with parameter names in the first row.
      <textarea
        aria-label="Table to preview"
        rows={3}
        className="w-full resize-y rounded border border-input bg-base p-2 font-code text-xs text-foreground select-text"
        placeholder="Paste your cells here, then edit the preview below."
        value={dialog.text}
        onChange={(event) => dialog.setText(event.target.value)}
        onPaste={(event) => event.stopPropagation()}
      />
    </label>
    <div className="flex shrink-0 items-center justify-between text-xs">
      <span className="font-semibold">Preview</span>
      <span className="text-muted-foreground">Map columns to get_val parameters, then edit values.</span>
    </div>
    <div className="min-h-0 flex-1 overflow-auto rounded border border-line">
      {dialog.cells.length === 0 ? (
        <p className="p-4 text-center text-xs text-muted-foreground">Your pasted table will appear here.</p>
      ) : (
        <table aria-label="Parameter table preview" className="w-full border-collapse text-xs text-foreground">
          <thead className="sticky top-0 z-10 bg-base">
            <tr>
              <th scope="col" className="border-b border-line px-2 text-muted-foreground">
                Row
              </th>
              {Array.from({ length: dialog.columnCount }, (_, column) => (
                <th
                  key={column}
                  scope="col"
                  className="min-w-36 border-b border-line p-1"
                  onPaste={(event) => event.stopPropagation()}
                >
                  <EditableComboBox
                    label={`get_val for column ${column + 1}`}
                    compact
                    value={dialog.cells[0][column] ?? ''}
                    items={dialog.parameterNames}
                    placeholder="Select or type get_val"
                    onTextChanged={(value) => dialog.editCell(0, column, value)}
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
);
