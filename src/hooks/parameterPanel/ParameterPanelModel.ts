import type { RuntimeParameterRequest, RuntimeResult } from '../../core/runtime/RuntimeTypes';
import {
  definitionId,
  neutralValueForType,
  parameterRowTexts,
  parameterSeed,
  refinedParameterValue,
} from '../../helpers/parameters';
import { adjacentCell, rowForKey } from '../../helpers/tableNavigation';
import type { ParameterEditor, ParameterPanelHandle, ParameterRow } from '../../types/panels';
import { isMacPlatform } from '../../utils/platform';
import { Observable } from '../observable/Observable';

export const kParameterValueColumn = 3;
export const kParameterHeaders = ['Parameter', 'Type', 'Variable', 'Value', 'Line'];
const ValueColumn = kParameterValueColumn;
const ColumnCount = kParameterHeaders.length;

export class ParameterPanelModel extends Observable implements ParameterPanelHandle {
  rows: ParameterRow[] = [];
  selectedRow = -1;
  currentRow = -1;
  currentColumn = -1;
  editor: ParameterEditor | null = null;
  #editorSerial = 0;

  #definitions: RuntimeParameterRequest[] = [];
  readonly #values = new Map<string, string>();
  readonly #userEditedKeys = new Set<string>();
  #changedCallback: (() => void) | null = null;
  #updating = false;
  #pressedCell: { row: number; column: number } | null = null;
  #pressedAlreadySelected = false;
  #pressClosedEditor = false;

  setPlaceholderData(): void {
    this.#definitions = [];
    this.#setRowCount0();
    this.changed();
  }

  setDefinitions(definitions: readonly RuntimeParameterRequest[]): void {
    this.#definitions = definitions.map((definition) => ({ ...definition }));

    for (const definition of this.#definitions) {
      const seed = parameterSeed(definition);
      if (!this.#values.has(definition.name)) {
        this.#values.set(definition.name, seed);
      } else if (!this.#userEditedKeys.has(definition.name)) {
        this.#values.set(definition.name, seed);
      }
    }

    this.#rebuildTable();
  }

  updateRuntimeResult(result: RuntimeResult): void {
    let changed = false;
    for (const request of result.parameterRequests) {
      if (request.sourceFunction !== 'get_val') continue;

      const it = this.#definitions.find((definition) => definitionId(definition) === definitionId(request));
      if (!it) continue;

      if (request.type !== '' && request.type !== 'unknown' && it.type !== request.type) {
        it.type = request.type;
        changed = true;
      }

      if (!this.#userEditedKeys.has(request.name)) {
        const value = this.#values.get(request.name);
        if (value !== undefined) {
          const refined = refinedParameterValue(request);
          if (refined !== null && value !== refined) {
            this.#values.set(request.name, refined);
            changed = true;
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
        texts: parameterRowTexts(definition, value),
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

  #itemChanged(row: ParameterRow, column: number): void {
    if (this.#updating || column !== ValueColumn) return;
    const key = row.key;
    if (key === '') return;

    this.#values.set(key, row.texts[ValueColumn].trim());
    this.#userEditedKeys.add(key);
    if (this.#changedCallback) this.#changedCallback();
  }

  #setCurrentCell(row: number, column: number): void {
    this.currentRow = row;
    this.currentColumn = column;
    this.selectedRow = row;
    this.changed();
  }

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

  commitEditor(serial?: number): void {
    const editor = this.editor;
    if (!editor || (serial !== undefined && editor.serial !== serial)) return;
    this.editor = null;
    this.changed();
    const row = this.rows[editor.row];
    if (!row || row.texts[ValueColumn] === editor.text) return;
    row.texts[ValueColumn] = editor.text;
    this.#itemChanged(row, ValueColumn);
  }

  revertEditor(): void {
    if (!this.editor) return;
    this.editor = null;
    this.changed();
  }

  commitEditorAndMove(backward: boolean): void {
    const editor = this.editor;
    if (!editor) return;
    this.commitEditor();
    if (!this.rows.length) return;
    this.#moveCurrentCell(backward);
    this.edit(this.currentRow, this.currentColumn);
  }

  #moveCurrentCell(backward: boolean): void {
    const cell = adjacentCell(this.currentRow, this.currentColumn, this.rows.length, ColumnCount, backward);
    this.#setCurrentCell(cell.row, cell.column);
  }

  mousePress(row: number, column: number, control: boolean, closedEditor = false): void {
    this.#pressClosedEditor = closedEditor || !!this.editor;
    this.commitEditor();
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
    if (click && this.#pressedAlreadySelected && !this.#pressClosedEditor) this.edit(row, column);
    this.#pressClosedEditor = false;
  }

  mouseDoubleClick(row: number, column: number): void {
    if (row < 0) return;
    this.edit(row, column);
  }

  keyPress(key: string, shift: boolean): boolean {
    if (!this.rows.length) return false;
    const row = Math.max(this.currentRow, 0);
    const column = Math.max(this.currentColumn, 0);
    switch (key) {
      case 'F2':
        return this.edit(this.currentRow, this.currentColumn);
      case 'Enter':
        if (!isMacPlatform) return false;

        return this.edit(this.currentRow, this.currentColumn);
      case 'ArrowLeft':
        this.#setCurrentCell(row, Math.max(column - 1, 0));

        return true;
      case 'ArrowRight':
        this.#setCurrentCell(row, Math.min(column + 1, ColumnCount - 1));

        return true;
      case 'Tab':
        this.#moveCurrentCell(shift);

        return true;
    }
    const next = rowForKey(key, this.currentRow, this.rows.length, false);
    if (next === null) return false;
    this.#setCurrentCell(next, column);

    return true;
  }
}
