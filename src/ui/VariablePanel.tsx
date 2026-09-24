// Port of ui/VariablePanel.{h,cpp}: a summary label and the Variables table
// (Name | Type | Current Value | Changed), single row selection.
//
// VariablePanelModel holds the QTableWidget state and the selection logic;
// the ref handle is that model, so MainWindow calls it synchronously.

import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react';
import type { RuntimeResult } from '../runtime/RuntimeTypes';
import { runtimeTypeName, runtimeValueToString } from '../runtime/RuntimeValue';
import { eventModifiers, Observable, useObservable } from './Observable';
import './ItemViews.css';

export interface VariablePanelHandle {
  setRuntimeResult(result: RuntimeResult, currentLine: number): void;
  selectVariable(name: string): void;
  selectedVariable(): string;
}

export interface VariableRow {
  name: string;
  type: string;
  value: string;
  changed: string;
}

export class VariablePanelModel extends Observable implements VariablePanelHandle {
  summary = '';
  rows: VariableRow[] = [];
  /** QTableWidget selection (SingleSelection, SelectRows): the selected row or -1. */
  selectedRow = -1;
  scrollRequest: { row: number; serial: number; center: boolean } | null = null;
  #scrollSerial = 0;
  #selectedName = '';
  #selectionChangedCallback: ((name: string) => void) | null = null;
  #signalsBlocked = false;

  setRuntimeResult(result: RuntimeResult, currentLine: number): void {
    const selectionToRestore = this.#selectedName;
    const blocked = this.#blockSignals(true);

    this.summary =
      `State after line ${currentLine}  |  ${result.variables.length} variable(s)  |  ` +
      `${result.variableChanges.length} change(s)  |  ${result.diagnostics.length} diagnostic(s)`;

    this.rows = result.variables.map((v) => ({
      name: v.name,
      type: runtimeTypeName(v.value),
      value: runtimeValueToString(v.value),
      changed: v.lastChangedLine > 0 ? `line ${v.lastChangedLine}` : '',
    }));
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
    this.scrollRequest = { row, serial: ++this.#scrollSerial, center: true }; // scrollToItem(PositionAtCenter)
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

  /** Changes the selection; emits itemSelectionChanged unless blocked. */
  #setSelectedRow(row: number): void {
    if (this.selectedRow === row) return;
    this.selectedRow = row;
    this.changed();
    if (!this.#signalsBlocked) this.#itemSelectionChanged();
  }

  // connect(m_table, &QTableWidget::itemSelectionChanged, ...)
  #itemSelectionChanged(): void {
    if (this.selectedRow < 0) return;
    const nameItem = this.rows[this.selectedRow];
    if (!nameItem) return;
    this.#selectedName = nameItem.name;
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.#selectedName);
  }

  // connect(m_table, &QTableWidget::itemClicked, ...)
  #itemClicked(row: number): void {
    // Re-activate an already selected variable after browsing an API/mesh.
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.rows[row].name);
  }

  // --- QTableView mouse/keyboard handling (SingleSelection) -------------------
  #pressedRow = -1;

  mousePress(row: number, control: boolean): void {
    this.#pressedRow = row;
    if (row < 0) return;
    // Ctrl+click deselects a selected row; otherwise ClearAndSelect.
    if (control && this.selectedRow === row) this.#setSelectedRow(-1);
    else this.#setSelectedRow(row);
  }

  mouseRelease(row: number): void {
    const click = row >= 0 && row === this.#pressedRow;
    this.#pressedRow = -1;
    if (click) this.#itemClicked(row);
  }

  keyPress(key: string): boolean {
    if (!this.rows.length) return false;
    const last = this.rows.length - 1;
    const current = this.selectedRow;
    let next: number;
    switch (key) {
      case 'ArrowUp':
        next = current < 0 ? 0 : Math.max(current - 1, 0);
        break;
      case 'ArrowDown':
        next = current < 0 ? 0 : Math.min(current + 1, last);
        break;
      case 'PageUp':
        next = Math.max(current - 10, 0);
        break;
      case 'PageDown':
        next = Math.min(Math.max(current, 0) + 10, last);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return false;
    }
    this.#setSelectedRow(next);
    this.scrollRequest = { row: next, serial: ++this.#scrollSerial, center: false };
    this.changed();
    return true;
  }
}

export interface VariablePanelProps {
  /** setSelectionChangedCallback */
  onSelectionChanged?: (name: string) => void;
  ref?: Ref<VariablePanelHandle>;
}

export function VariablePanel({ onSelectionChanged, ref }: VariablePanelProps) {
  const [model] = useState(() => new VariablePanelModel());
  useObservable(model);
  const tableRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    model.setSelectionChangedCallback(onSelectionChanged ?? null);
  }, [model, onSelectionChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const scrollSerial = model.scrollRequest?.serial;
  useLayoutEffect(() => {
    const request = model.scrollRequest;
    if (!request) return;
    const row = tableRef.current?.querySelector<HTMLElement>(`tr[data-row="${request.row}"]`);
    row?.scrollIntoView({ block: request.center ? 'center' : 'nearest' });
  }, [model, scrollSerial]);

  const rowOf = (event: MouseEvent) => {
    const row = (event.target as Element).closest<HTMLElement>('tr[data-row]');
    return row ? Number(row.dataset.row) : -1;
  };
  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || (event.target as Element).closest('thead')) return;
    event.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    model.mousePress(rowOf(event), eventModifiers(event).control);
  };
  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0 || (event.target as Element).closest('thead')) return;
    model.mouseRelease(rowOf(event));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (model.keyPress(event.key)) event.preventDefault();
  };

  return (
    <div className="variable-panel panel-margins">
      <div className="panel-summary">{model.summary}</div>
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
              <th className="fit">Name</th>
              <th className="fit">Type</th>
              <th className="stretch">Current Value</th>
              <th className="fit">Changed</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, index) => (
              <tr key={index} data-row={index} className={index === model.selectedRow ? 'selected' : undefined}>
                <td>{row.name}</td>
                <td>{row.type}</td>
                <td>{row.value}</td>
                <td>{row.changed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
