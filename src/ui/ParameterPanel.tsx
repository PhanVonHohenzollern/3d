// Port of ui/ParameterPanel.{h,cpp}: the Parameters table
// (Parameter | Type | Variable | Value | Line). Definitions come from a
// static full-source scan of get_val(...), independent of the cursor; only
// the Value column is editable (double-click, click on a selected row, or the
// edit key), and user-entered values stay sticky across rebuilds.
//
// ParameterPanelModel holds the QTableWidget state; the ref handle is that
// model, so MainWindow calls it synchronously.

import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react';
import type { RuntimeParameterRequest, RuntimeResult } from '../runtime/RuntimeTypes';
import { eventModifiers, isMacPlatform, Observable, trimmed, useObservable } from './Observable';
import './ItemViews.css';

const ValueColumn = 3;
const ColumnCount = 5;

function neutralValueForType(type: string): string {
  if (type === 'bool') return 'false';
  if (type === 'string') return '';
  return '0';
}

export interface ParameterPanelHandle {
  setPlaceholderData(): void;
  /**
   * Definitions come from a static full-source scan of get_val(...). This is
   * deliberately independent from the execution cursor.
   */
  setDefinitions(definitions: readonly RuntimeParameterRequest[]): void;
  /**
   * Runtime requests refine types/values for get_val calls that have actually
   * executed, without removing definitions that are below the current cursor.
   */
  updateRuntimeResult(result: RuntimeResult): void;
  values(): Map<string, string>;
}

export interface ParameterRow {
  /** InputKeyRole of the Value item: the get_val parameter name. */
  key: string;
  /** InputLineRole */
  line: number;
  texts: string[];
}

export class ParameterPanelModel extends Observable implements ParameterPanelHandle {
  rows: ParameterRow[] = [];
  /** Selected row (SingleSelection, SelectRows) or -1. */
  selectedRow = -1;
  /** QTableWidget current cell. */
  currentRow = -1;
  currentColumn = -1;
  /** Open editor on a Value cell. */
  editor: { row: number; text: string; serial: number } | null = null;
  #editorSerial = 0;

  #definitions: RuntimeParameterRequest[] = [];
  readonly #values = new Map<string, string>();
  readonly #userEditedKeys = new Set<string>();
  #changedCallback: (() => void) | null = null;
  #updating = false;

  setPlaceholderData(): void {
    this.#definitions = [];
    this.#setRowCount0();
    this.changed();
  }

  static definitionId(request: RuntimeParameterRequest): string {
    return `${request.name}\n${request.variableName}`;
  }

  setDefinitions(definitions: readonly RuntimeParameterRequest[]): void {
    this.#definitions = definitions.map((definition) => ({ ...definition }));

    for (const definition of this.#definitions) {
      let seed = definition.defaultValue;
      if (seed === '' && definition.type !== 'string') seed = definition.currentValue;
      if (seed === '' && definition.type !== 'string') seed = neutralValueForType(definition.type);

      if (!this.#values.has(definition.name)) {
        this.#values.set(definition.name, seed);
      } else if (!this.#userEditedKeys.has(definition.name)) {
        // Source defaults are allowed to change while the user is editing
        // code. Explicit user overrides remain sticky across rebuilds.
        this.#values.set(definition.name, seed);
      }
    }

    this.#rebuildTable();
  }

  updateRuntimeResult(result: RuntimeResult): void {
    let changed = false;
    for (const request of result.parameterRequests) {
      if (request.sourceFunction !== 'get_val') continue;

      const it = this.#definitions.find(
        (definition) => ParameterPanelModel.definitionId(definition) === ParameterPanelModel.definitionId(request),
      );
      if (!it) continue;

      if (request.type !== '' && request.type !== 'unknown' && it.type !== request.type) {
        it.type = request.type;
        changed = true;
      }

      // Never overwrite a user-entered value. For untouched parameters the
      // runtime can refine a static default when it knows a better one.
      if (!this.#userEditedKeys.has(request.name)) {
        const value = this.#values.get(request.name);
        if (value !== undefined) {
          let refined = request.defaultValue;
          if (refined === '' && request.type !== 'string') refined = request.currentValue;
          if (refined !== '' || request.type === 'string') {
            if (value !== refined) {
              this.#values.set(request.name, refined);
              changed = true;
            }
          }
        }
      }
    }

    if (changed) this.#rebuildTable();
  }

  #rebuildTable(): void {
    let selectedKey = '';
    if (this.selectedRow >= 0 && this.selectedRow < this.rows.length) selectedKey = this.rows[this.selectedRow].key;

    this.#updating = true;
    this.#setRowCount0();

    let selectedRow = -1;
    for (const definition of this.#definitions) {
      const row = this.rows.length;
      const value = this.#values.get(definition.name) ?? neutralValueForType(definition.type);
      this.rows.push({
        key: definition.name,
        line: definition.line,
        texts: [definition.name, definition.type, definition.variableName, value, String(definition.line)],
      });
      if (selectedKey !== '' && selectedKey === definition.name) selectedRow = row;
    }

    if (selectedRow >= 0) {
      this.selectedRow = selectedRow;
      this.currentRow = selectedRow;
      this.currentColumn = ValueColumn;
    }

    this.#updating = false;
    this.changed();
  }

  /** m_table->setRowCount(0): drops rows, selection, current cell and any open editor. */
  #setRowCount0(): void {
    this.rows = [];
    this.selectedRow = -1;
    this.currentRow = -1;
    this.currentColumn = -1;
    this.editor = null;
  }

  values(): Map<string, string> {
    return new Map(this.#values);
  }

  setChangedCallback(callback: (() => void) | null): void {
    this.#changedCallback = callback;
  }

  // connect(m_table, &QTableWidget::itemChanged, ...)
  #itemChanged(row: ParameterRow, column: number): void {
    if (this.#updating || column !== ValueColumn) return;
    const key = row.key;
    if (key === '') return;

    this.#values.set(key, trimmed(row.texts[ValueColumn]));
    this.#userEditedKeys.add(key);
    if (this.#changedCallback) this.#changedCallback();
  }

  // --- QTableView interaction ---------------------------------------------------
  #pressedCell: { row: number; column: number } | null = null;
  #pressedAlreadySelected = false;
  #pressClosedEditor = false;

  #setCurrentCell(row: number, column: number): void {
    this.currentRow = row;
    this.currentColumn = column;
    this.selectedRow = row;
    this.changed();
  }

  /** Editing starts only on the Value column (other items are not editable). */
  edit(row: number, column: number): boolean {
    if (column !== ValueColumn || row < 0 || row >= this.rows.length) return false;
    this.editor = { row, text: this.rows[row].texts[ValueColumn], serial: ++this.#editorSerial };
    this.changed();
    return true;
  }

  editorTextEdited(text: string): void {
    if (!this.editor) return;
    this.editor = { ...this.editor, text };
    this.changed();
  }

  /**
   * QStyledItemDelegate::setModelData + closeEditor. With `serial`, only
   * that editor is committed (a stale focus-out after Tab is ignored).
   */
  commitEditor(serial?: number): void {
    const editor = this.editor;
    if (!editor || (serial !== undefined && editor.serial !== serial)) return;
    this.editor = null;
    this.changed();
    const row = this.rows[editor.row];
    // QTableWidgetItem::setData() only reports real changes.
    if (!row || row.texts[ValueColumn] === editor.text) return;
    row.texts[ValueColumn] = editor.text;
    this.#itemChanged(row, ValueColumn);
  }

  /** Escape: close the editor without committing. */
  revertEditor(): void {
    if (!this.editor) return;
    this.editor = null;
    this.changed();
  }

  /** QAbstractItemDelegate::EditNextItem / EditPreviousItem after Tab / Backtab. */
  commitEditorAndMove(backward: boolean): void {
    const editor = this.editor;
    if (!editor) return;
    this.commitEditor();
    if (!this.rows.length) return;
    this.#moveCurrentCell(backward ? 'previous' : 'next');
    this.edit(this.currentRow, this.currentColumn);
  }

  #moveCurrentCell(direction: 'next' | 'previous'): void {
    const rowCount = this.rows.length;
    let row = Math.max(this.currentRow, 0);
    let column = Math.max(this.currentColumn, 0);
    if (direction === 'next') {
      if (++column >= ColumnCount) {
        column = 0;
        row = (row + 1) % rowCount;
      }
    } else if (--column < 0) {
      column = ColumnCount - 1;
      row = (row - 1 + rowCount) % rowCount;
    }
    this.#setCurrentCell(row, column);
  }

  /** `closedEditor`: an editor was open when the press started (it loses focus now). */
  mousePress(row: number, column: number, control: boolean, closedEditor = false): void {
    this.#pressClosedEditor = closedEditor || !!this.editor;
    this.commitEditor(); // the editor loses focus
    this.#pressedCell = row >= 0 ? { row, column } : null;
    this.#pressedAlreadySelected = row >= 0 && row === this.selectedRow;
    if (row < 0 || row >= this.rows.length) return;
    this.currentRow = row;
    this.currentColumn = column;
    if (control && this.selectedRow === row) this.selectedRow = -1;
    else this.selectedRow = row;
    this.changed();
  }

  mouseRelease(row: number, column: number): void {
    const pressed = this.#pressedCell;
    this.#pressedCell = null;
    const click = !!pressed && pressed.row === row && pressed.column === column;
    // QAbstractItemView::SelectedClicked
    if (click && this.#pressedAlreadySelected && !this.#pressClosedEditor) this.edit(row, column);
    this.#pressClosedEditor = false;
  }

  /** QAbstractItemView::DoubleClicked */
  mouseDoubleClick(row: number, column: number): void {
    if (row < 0) return;
    this.edit(row, column);
  }

  keyPress(key: string, shift: boolean): boolean {
    if (!this.rows.length) return false;
    const last = this.rows.length - 1;
    const row = Math.max(this.currentRow, 0);
    const column = Math.max(this.currentColumn, 0);
    switch (key) {
      case 'F2':
        return this.edit(this.currentRow, this.currentColumn);
      case 'Enter':
        if (!isMacPlatform) return false;
        return this.edit(this.currentRow, this.currentColumn); // the macOS edit key
      case 'ArrowUp':
        this.#setCurrentCell(this.currentRow < 0 ? 0 : Math.max(row - 1, 0), column);
        return true;
      case 'ArrowDown':
        this.#setCurrentCell(this.currentRow < 0 ? 0 : Math.min(row + 1, last), column);
        return true;
      case 'ArrowLeft':
        this.#setCurrentCell(row, Math.max(column - 1, 0));
        return true;
      case 'ArrowRight':
        this.#setCurrentCell(row, Math.min(column + 1, ColumnCount - 1));
        return true;
      case 'Home':
        this.#setCurrentCell(0, column);
        return true;
      case 'End':
        this.#setCurrentCell(last, column);
        return true;
      case 'Tab':
        this.#moveCurrentCell(shift ? 'previous' : 'next');
        return true; // setTabKeyNavigation(true)
      default:
        return false;
    }
  }
}

export interface ParameterPanelProps {
  /** setChangedCallback */
  onChanged?: () => void;
  ref?: Ref<ParameterPanelHandle>;
}

const kHeaders = ['Parameter', 'Type', 'Variable', 'Value', 'Line'];

export function ParameterPanel({ onChanged, ref }: ParameterPanelProps) {
  const [model] = useState(() => new ParameterPanelModel());
  useObservable(model);
  const tableRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    model.setChangedCallback(onChanged ?? null);
  }, [model, onChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const editorSerial = model.editor?.serial;
  useLayoutEffect(() => {
    if (editorSerial === undefined) return;
    editorRef.current?.focus();
    editorRef.current?.select();
  }, [editorSerial]);

  const cellOf = (event: MouseEvent) => {
    const cell = (event.target as Element).closest<HTMLElement>('td[data-column]');
    const row = cell?.closest<HTMLElement>('tr[data-row]');
    return row && cell
      ? { row: Number(row.dataset.row), column: Number(cell.dataset.column) }
      : { row: -1, column: -1 };
  };
  const inEditor = (event: MouseEvent) => !!(event.target as Element).closest('input');
  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || inEditor(event) || (event.target as Element).closest('thead')) return;
    event.preventDefault();
    const { row, column } = cellOf(event);
    if (event.detail === 2) {
      model.mouseDoubleClick(row, column);
      return;
    }
    const closedEditor = model.editor !== null;
    tableRef.current?.focus({ preventScroll: true }); // commits an open editor (focus out)
    model.mousePress(row, column, eventModifiers(event).control, closedEditor);
  };
  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0 || inEditor(event) || (event.target as Element).closest('thead')) return;
    const { row, column } = cellOf(event);
    model.mouseRelease(row, column);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== tableRef.current || event.altKey || event.ctrlKey || event.metaKey) return;
    if (model.keyPress(event.key, event.shiftKey)) event.preventDefault();
  };
  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      model.commitEditor();
      tableRef.current?.focus({ preventScroll: true });
    } else if (event.key === 'Escape') {
      // The delegate consumes Esc: it cancels editing and is no window shortcut.
      event.preventDefault();
      event.stopPropagation();
      model.revertEditor();
      tableRef.current?.focus({ preventScroll: true });
    } else if (event.key === 'Tab') {
      event.preventDefault();
      model.commitEditorAndMove(event.shiftKey);
      if (!model.editor) tableRef.current?.focus({ preventScroll: true });
    }
  };
  const onEditorBlur = (event: FocusEvent<HTMLInputElement>) =>
    model.commitEditor(Number(event.currentTarget.dataset.serial));

  return (
    <div className="parameter-panel">
      <div
        ref={tableRef}
        className="table-view"
        tabIndex={0}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onKeyDown={onKeyDown}
      >
        <table className="item-table">
          <thead>
            <tr className="item-header">
              {kHeaders.map((header, column) => (
                <th key={header} className={column === ValueColumn ? 'stretch' : 'fit'}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, index) => (
              <tr key={index} data-row={index} className={index === model.selectedRow ? 'selected' : undefined}>
                {row.texts.map((text, column) => {
                  const editing = model.editor && model.editor.row === index && column === ValueColumn;
                  const current = index === model.currentRow && column === model.currentColumn;
                  return (
                    <td
                      key={column}
                      data-column={column}
                      className={`${current ? 'current-cell' : ''}${editing ? ' editing' : ''}`}
                    >
                      {editing ? (
                        <input
                          ref={editorRef}
                          data-serial={model.editor!.serial}
                          className="cell-editor"
                          value={model.editor!.text}
                          spellCheck={false}
                          onChange={(e) => model.editorTextEdited(e.target.value)}
                          onKeyDown={onEditorKeyDown}
                          onBlur={onEditorBlur}
                        />
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
