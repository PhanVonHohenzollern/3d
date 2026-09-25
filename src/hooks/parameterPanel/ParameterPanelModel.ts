import { parameterKey, type RuntimeParameterRequest, type RuntimeResult } from '../../core/runtime/RuntimeTypes';
import { GeometryRuntime } from '../../core/runtime/GeometryRuntime';
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
import { parseParameterTable } from '../../helpers/parameterTable';

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
  dataSets: ReadonlyMap<string, string>[] = [];
  dataSetIndex = -1;
  pasteMessage = '';
  pasteIsError = false;
  extInsulationEnabled = false;
  activeTab = '';
  #source = '';
  #activeKeys: Set<string> | null = null;
  readonly #tableTabs = new Map<string, { dataSets: ReadonlyMap<string, string>[]; index: number }>();

  get tabs() {
    return [...new Set(this.#definitions.map((definition) => definition.functionName ?? ''))].map((id) => ({
      id,
      label: id || 'Element',
      enabled: this.rows.some((row) => (row.functionName ?? '') === id && !row.disabled),
    }));
  }

  selectTab(id: string): void {
    if (!this.tabs.some((tab) => tab.id === id) || id === this.activeTab) return;
    this.commitEditor();
    this.#tableTabs.set(this.activeTab, { dataSets: this.dataSets, index: this.dataSetIndex });
    this.activeTab = id;
    this.dataSets = this.#tableTabs.get(id)?.dataSets ?? [];
    this.dataSetIndex = this.#tableTabs.get(id)?.index ?? -1;
    this.pasteMessage = '';
    this.changed();
  }

  #refreshAvailability(): void {
    this.#activeKeys = null;
    if (!this.#source) return;
    const runtime = new GeometryRuntime();
    runtime.setParameters(this.overrides());
    const result = runtime.executeUpToLine(this.#source, this.#source.split('\n').length, true);
    this.#activeKeys = new Set(result.parameterRequests.map(parameterKey));
  }

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
    this.#source = '';
    this.#activeKeys = null;
    this.activeTab = '';
    this.extInsulationEnabled = false;
    this.#setRowCount0();
    this.changed();
  }

  setDefinitions(definitions: readonly RuntimeParameterRequest[], source = ''): void {
    this.#source = source;
    this.#definitions = definitions.map((definition) => ({ ...definition }));
    if (!this.#definitions.some((definition) => definition.sourceFunction === 'getExtInsSize'))
      this.extInsulationEnabled = false;

    for (const definition of this.#definitions) {
      const key = parameterKey(definition);
      const seed = parameterSeed(definition);
      if (!this.#values.has(key)) {
        this.#values.set(key, seed);
      } else if (!this.#userEditedKeys.has(key)) {
        this.#values.set(key, seed);
      }
    }

    if (!this.#definitions.some((definition) => (definition.functionName ?? '') === this.activeTab))
      this.activeTab = this.#definitions[0]?.functionName ?? '';
    this.#refreshAvailability();
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

      const key = parameterKey(request);
      if (!this.#userEditedKeys.has(key)) {
        const value = this.#values.get(key);
        if (value !== undefined) {
          const refined = refinedParameterValue(request);
          if (refined !== null && value !== refined) {
            this.#values.set(key, refined);
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
      const key = parameterKey(definition);
      const insulation = definition.sourceFunction === 'getExtInsSize';
      if (insulation)
        this.rows.push({
          key: 'getExtInsSize.enabled',
          line: definition.line,
          checkbox: true,
          functionName: definition.functionName,
          texts: ['getExtInsSize', 'bool', '', String(this.extInsulationEnabled), String(definition.line)],
        });
      const row = this.rows.length;
      const value = this.#values.get(key) ?? neutralValueForType(definition.type);
      const texts = parameterRowTexts(definition, value);
      if (insulation) texts[0] = 'size';
      this.rows.push({
        key,
        functionName: definition.functionName,
        line: definition.line,
        texts,
        checkbox: !!definition.checkbox,
        disabled: insulation ? !this.extInsulationEnabled : !!this.#activeKeys && !this.#activeKeys.has(key),
      });
      if (selectedKey !== '' && selectedKey === key) selectedRow = row;
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

  overrides(): Map<string, string> {
    const insulation = this.#definitions.some((definition) => definition.sourceFunction === 'getExtInsSize');
    const values = new Map(
      this.#definitions
        .filter((definition) => definition.sourceFunction !== 'getExtInsSize')
        .map((definition) => parameterKey(definition))
        .filter((key) => this.#userEditedKeys.has(key))
        .map((key) => [key, this.#values.get(key)!]),
    );
    // A removed query must not leave an enabled thickness in the runtime configuration.
    if (!insulation && !this.#definitions.some((definition) => definition.name === 'getExtInsSize'))
      values.delete('getExtInsSize');
    if (insulation && this.extInsulationEnabled) {
      const definition = this.#definitions.find((item) => item.sourceFunction === 'getExtInsSize')!;
      values.set('getExtInsSize', this.#values.get(parameterKey(definition)) ?? '0');
    }

    return values;
  }

  setExtInsulationEnabled(enabled: boolean): void {
    if (
      this.extInsulationEnabled === enabled ||
      !this.#definitions.some((definition) => definition.sourceFunction === 'getExtInsSize')
    )
      return;
    this.extInsulationEnabled = enabled;
    this.#refreshAvailability();
    this.#rebuildTable();
    this.#changedCallback?.();
  }

  previewTable(text: string) {
    return parseParameterTable(
      text,
      this.#definitions.filter((definition) => (definition.functionName ?? '') === this.activeTab),
    );
  }

  setCheckbox(key: string, checked: boolean): void {
    if (key === 'getExtInsSize.enabled') {
      this.setExtInsulationEnabled(checked);

      return;
    }
    const row = this.rows.find((item) => item.key === key);
    if (!row || row.disabled || !row.checkbox) return;
    this.#values.set(key, row.texts[1] === 'bool' ? String(checked) : checked ? '1' : '0');
    this.#userEditedKeys.add(key);
    this.dataSetIndex = -1;
    this.#refreshAvailability();
    this.#rebuildTable();
    this.#changedCallback?.();
  }

  importTable(text: string): boolean {
    try {
      const parsed = this.previewTable(text);
      this.dataSets = parsed.data;
      this.pasteIsError = false;
      this.pasteMessage =
        `${parsed.data.length} data row(s), ${parsed.columns} parameter(s)` +
        (parsed.ignored.length ? ` · Ignored: ${parsed.ignored.join(', ')}` : '');
      this.selectDataSet(0);

      return true;
    } catch (error) {
      this.pasteIsError = true;
      this.pasteMessage = error instanceof Error ? error.message : String(error);
      this.changed();

      return false;
    }
  }

  selectDataSet(index: number): void {
    const data = this.dataSets[index];
    if (!data) return;
    this.dataSetIndex = index;
    this.editor = null;
    for (const [key, value] of data) {
      const row = this.rows.find((item) => item.key === key);
      if (!row?.checkbox || row.disabled) continue;
      this.#values.set(key, value);
      this.#userEditedKeys.add(key);
    }
    this.#refreshAvailability();
    for (const [key, value] of data) {
      const definition = this.#definitions.find((item) => parameterKey(item) === key);
      if (
        !definition ||
        (definition.sourceFunction === 'getExtInsSize'
          ? !this.extInsulationEnabled
          : this.#activeKeys && !this.#activeKeys.has(key))
      )
        continue;
      this.#values.set(key, value);
      this.#userEditedKeys.add(key);
    }
    this.#refreshAvailability();
    this.#rebuildTable();
    this.#changedCallback?.();
  }

  resetToSource(): void {
    this.extInsulationEnabled = false;
    this.dataSetIndex = -1;
    this.#userEditedKeys.clear();
    this.#values.clear();
    for (const definition of this.#definitions) this.#values.set(parameterKey(definition), parameterSeed(definition));
    this.#refreshAvailability();
    this.#rebuildTable();
    this.#changedCallback?.();
  }

  setChangedCallback(callback: (() => void) | null): void {
    this.#changedCallback = callback;
  }

  #itemChanged(row: ParameterRow, column: number): void {
    if (this.#updating || column !== ValueColumn) return;
    const key = row.key;
    if (key === '') return;

    const value = row.texts[ValueColumn].trim();
    const matches = this.dataSets.flatMap((data, index) => (data.get(key) === value ? [index] : []));
    if (matches.length === 1) {
      this.selectDataSet(matches[0]);

      return;
    }
    this.dataSetIndex = -1;

    this.#values.set(key, value);
    this.#userEditedKeys.add(key);
    this.#refreshAvailability();
    this.#rebuildTable();
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
    if (this.rows[row].disabled || this.rows[row].checkbox) return false;
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
