import type { RuntimeResult } from '../../core/runtime/RuntimeTypes';
import { rowForKey } from '../../helpers/tableNavigation';
import { variableRow, variableSummary } from '../../helpers/variables';
import type { ScrollRequest, VariablePanelHandle, VariableRow } from '../../types/panels';
import { Observable } from '../observable/Observable';

export class VariablePanelModel extends Observable implements VariablePanelHandle {
  summary = '';
  rows: VariableRow[] = [];
  selectedRow = -1;
  scrollRequest: ScrollRequest | null = null;
  #scrollSerial = 0;
  #selectedName = '';
  #selectionChangedCallback: ((name: string) => void) | null = null;
  #signalsBlocked = false;
  #pressedRow = -1;

  setRuntimeResult(result: RuntimeResult, currentLine: number): void {
    const selectionToRestore = this.#selectedName;
    const blocked = this.#blockSignals(true);

    this.summary = variableSummary(result, currentLine);
    this.rows = result.variables.map(variableRow);
    if (this.selectedRow >= this.rows.length) this.selectedRow = -1;

    const row = this.#findRow(selectionToRestore);
    if (row >= 0) {
      this.#selectRow(row);
      this.#selectedName = selectionToRestore;
    } else {
      this.#setSelectedRow(-1);
      this.#selectedName = '';
    }
    this.#blockSignals(blocked);
    this.changed();
  }

  setSelectionChangedCallback(callback: ((name: string) => void) | null): void {
    this.#selectionChangedCallback = callback;
  }

  selectVariable(name: string): void {
    const row = this.#findRow(name);
    if (row < 0) return;

    const blocked = this.#blockSignals(true);
    this.#selectRow(row);
    this.scrollRequest = { row, serial: ++this.#scrollSerial, center: true };
    this.#selectedName = name;
    this.#blockSignals(blocked);
    this.changed();
  }

  selectedVariable(): string {
    return this.#selectedName;
  }

  #findRow(name: string): number {
    if (name === '') return -1;
    return this.rows.findIndex((row) => row.name === name);
  }

  #blockSignals(block: boolean): boolean {
    const previous = this.#signalsBlocked;
    this.#signalsBlocked = block;
    return previous;
  }

  #selectRow(row: number): void {
    this.#setSelectedRow(row);
  }

  #setSelectedRow(row: number): void {
    if (this.selectedRow === row) return;
    this.selectedRow = row;
    this.changed();
    if (!this.#signalsBlocked) this.#itemSelectionChanged();
  }

  #itemSelectionChanged(): void {
    if (this.selectedRow < 0) return;
    const nameItem = this.rows[this.selectedRow];
    if (!nameItem) return;
    this.#selectedName = nameItem.name;
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.#selectedName);
  }

  #itemClicked(row: number): void {
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.rows[row].name);
  }

  mousePress(row: number, control: boolean): void {
    this.#pressedRow = row;
    if (row < 0) return;
    if (control && this.selectedRow === row) this.#setSelectedRow(-1);
    else this.#setSelectedRow(row);
  }

  mouseRelease(row: number): void {
    const click = row >= 0 && row === this.#pressedRow;
    this.#pressedRow = -1;
    if (click) this.#itemClicked(row);
  }

  keyPress(key: string): boolean {
    const next = rowForKey(key, this.selectedRow, this.rows.length, true);
    if (next === null) return false;
    this.#setSelectedRow(next);
    this.scrollRequest = { row: next, serial: ++this.#scrollSerial, center: false };
    this.changed();
    return true;
  }
}
