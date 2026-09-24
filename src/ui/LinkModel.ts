// Port of the logic of ui/LinkPanel.{h,cpp}: named connectors with a Link
// test preview (geometry/ConnectorPreview). Definitions live in memory for the
// session; tests never insert code, runtime variables or API Trace rows.
//
// The model holds both the connector entries and the state of the Qt widgets
// (table current cell, form fields, status label), so the slot functions can
// be ported line by line. LinkPanel.tsx renders it.

import {
  buildConnectorPreview, connectorOrientations, defaultConnectorDefinition,
  type ConnectorDefinition, type ConnectorExpressionEvaluator, type ConnectorPreview, type ConnectorType,
} from '../geometry/ConnectorPreview';
import { formatGeneral, what } from '../runtime/CppCompat';
import type { RuntimeResult } from '../runtime/RuntimeTypes';
import { Observable, trimmed } from './Observable';

export type PreviewChangedCallback = (previews: readonly ConnectorPreview[], selectedId: number, tested: boolean) => void;

interface Entry {
  definition: ConnectorDefinition;
  preview: ConnectorPreview | null;
  error: string;
  shown: boolean;
}

export interface LinkTableRow {
  id: number;
  /** Connector, Point, Type, Position */
  texts: string[];
  /** Text of the row's Show/Hide tool button. */
  buttonText: string;
}

export type SizeField = 'diameter' | 'aSize' | 'bSize';

export const kConnectorTypes: readonly ConnectorType[] = ['Circular', 'Rectangular'];
export const kOrientationLabels = ['X+', 'X-', 'Y+', 'Y-', 'Z+', 'Z-'] as const;

function coordinates(point: { x: number; y: number; z: number }): string {
  return `(${formatGeneral(point.x, 8)}, ${formatGeneral(point.y, 8)}, ${formatGeneral(point.z, 8)})`;
}

function copyDefinition(d: ConnectorDefinition): ConnectorDefinition {
  return { ...d, position: [...d.position], angles: [...d.angles] };
}

const sameArray = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** The LinkPanel public interface MainWindow uses. */
export interface LinkPanelHandle {
  updateRuntimeResult(result: RuntimeResult): void;
  selectConnector(id: number): void;
  exitPreview(): void;
}

export class LinkPanelModel extends Observable implements LinkPanelHandle {
  // --- QTableWidget m_table ------------------------------------------------------
  tableRows: LinkTableRow[] = [];
  currentRow = -1;
  currentColumn = -1;
  scrollRequest: { row: number; serial: number } | null = null;
  #scrollSerial = 0;
  #tableSignalsBlocked = false;

  // --- form widgets ------------------------------------------------------------
  formEnabled = false;
  nameText = '';
  pointText = '';
  typeIndex = 0;
  sizeTexts: Record<SizeField, string> = { diameter: '', aSize: '', bSize: '' };
  /** Items of the three size combo boxes. */
  parameterNames: string[] = [];
  orientationId = 0;
  positionTexts: [string, string, string] = ['0', '0', '0'];
  angleTexts: [string, string, string] = ['0', '0', '0'];
  /** updateSizeFields(): Diameter row visible for Circular, A/B row otherwise. */
  circularFields = true;
  statusText = '';
  statusIsError = false;
  /** m_name->setFocus(); m_name->selectAll(); requests. */
  focusNameSerial = 0;
  #pointEditedSinceFinished = false;

  #entries: Entry[] = [];
  #nextId = 1;
  #loading = false;
  #evaluate: ConnectorExpressionEvaluator | null = null;
  #previewChanged: PreviewChangedCallback | null = null;

  constructor() {
    super();
    this.formEnabled = false;
    this.updateSizeFields();
  }

  setExpressionEvaluator(evaluate: ConnectorExpressionEvaluator | null): void { this.#evaluate = evaluate; }
  setPreviewChangedCallback(callback: PreviewChangedCallback | null): void { this.#previewChanged = callback; }

  /** Read-only view of the connector definitions (tests and diagnostics). */
  definitions(): ConnectorDefinition[] { return this.#entries.map((entry) => copyDefinition(entry.definition)); }

  // --- m_table helpers ---------------------------------------------------------
  /** QTableWidget::setCurrentCell(): emits currentCellChanged -> loadSelection(). */
  #setCurrentCell(row: number, column: number): void {
    if (row === this.currentRow && column === this.currentColumn) return;
    this.currentRow = row;
    this.currentColumn = column;
    this.changed();
    if (!this.#tableSignalsBlocked) this.loadSelection();
  }

  /** A cell was pressed / reached with the keyboard in the table. */
  cellActivated(row: number, column: number): void {
    if (row < 0 || row >= this.tableRows.length) return;
    this.#setCurrentCell(row, column);
  }

  tableKeyPress(key: string): boolean {
    const last = this.tableRows.length - 1;
    if (last < 0) return false;
    const row = this.currentRow;
    const column = Math.max(this.currentColumn, 0);
    switch (key) {
      case 'ArrowUp': this.#setCurrentCell(row < 0 ? 0 : Math.max(row - 1, 0), column); break;
      case 'ArrowDown': this.#setCurrentCell(row < 0 ? 0 : Math.min(row + 1, last), column); break;
      case 'Home': this.#setCurrentCell(0, column); break;
      case 'End': this.#setCurrentCell(last, column); break;
      default: return false;
    }
    this.scrollRequest = { row: this.currentRow, serial: ++this.#scrollSerial };
    this.changed();
    return true;
  }

  // --- slots -------------------------------------------------------------------
  addConnector(): void {
    const definition = defaultConnectorDefinition();
    definition.id = this.#nextId++;
    definition.name = `Connector ${definition.id}`;
    let pointIndex = definition.id;
    do {
      definition.pointName = `linkPoint${pointIndex++}`;
    } while (this.#entries.some((other) => other.definition.pointName === definition.pointName));
    this.#entries.push({ definition, preview: null, error: '', shown: false });
    const row = this.#entries.length - 1;
    this.tableRows.length = row + 1;
    this.refreshRow(row);
    this.#setCurrentCell(row, 1);
    ++this.focusNameSerial;
    this.changed();
  }

  removeConnector(): void {
    const row = this.currentRow;
    if (row < 0) return;
    {
      const blocked = this.#tableSignalsBlocked;
      this.#tableSignalsBlocked = true;
      this.#entries.splice(row, 1);
      this.tableRows.splice(row, 1);
      if (this.#entries.length) this.#setCurrentCell(Math.min(row, this.#entries.length - 1), 1);
      else { this.currentRow = -1; this.currentColumn = -1; }
      this.#tableSignalsBlocked = blocked;
    }
    this.changed();
    this.loadSelection();
  }

  loadSelection(): void {
    if (this.#loading) return;
    const row = this.currentRow;
    const valid = row >= 0 && row < this.#entries.length;
    this.formEnabled = valid;
    if (valid) {
      this.#loading = true;
      const d = this.#entries[row].definition;
      this.nameText = d.name; this.#setPointText(d.pointName);
      this.typeIndex = kConnectorTypes.indexOf(d.type);
      this.sizeTexts = { diameter: d.diameter, aSize: d.aSize, bSize: d.bSize };
      this.orientationId = connectorOrientations.indexOf(d.orientation);
      this.positionTexts = [...d.position];
      this.angleTexts = [...d.angles];
      this.#loading = false;
    }
    this.changed();
    this.updateSizeFields(); this.showStatus(); this.publish();
  }

  saveSelection(): void {
    const row = this.currentRow;
    if (this.#loading || row < 0 || row >= this.#entries.length) return;
    const entry = this.#entries[row];
    const d = entry.definition;
    const previous = copyDefinition(d);
    d.name = trimmed(this.nameText);
    d.type = kConnectorTypes[this.typeIndex];
    d.diameter = trimmed(this.sizeTexts.diameter);
    d.aSize = trimmed(this.sizeTexts.aSize);
    d.bSize = trimmed(this.sizeTexts.bSize);
    d.orientation = connectorOrientations[this.orientationId];
    for (let i = 0; i < 3; ++i) {
      d.position[i] = trimmed(this.positionTexts[i]);
      d.angles[i] = trimmed(this.angleTexts[i]);
    }
    const geometryChanged = d.type !== previous.type || d.orientation !== previous.orientation
      || d.diameter !== previous.diameter || d.aSize !== previous.aSize || d.bSize !== previous.bSize
      || !sameArray(d.position, previous.position) || !sameArray(d.angles, previous.angles);
    if (geometryChanged) { entry.preview = null; entry.shown = false; }
    else if (entry.preview) entry.preview = { ...entry.preview, name: d.name };
    entry.error = '';
    this.refreshRow(row); this.showStatus(); this.publish();
  }

  testSelection(): void {
    const row = this.currentRow;
    if (row < 0 || !this.#evaluate) return;
    const entry = this.#entries[row];
    try {
      entry.preview = buildConnectorPreview(entry.definition, this.#evaluate);
      entry.shown = true;
      entry.error = '';
    } catch (e) {
      entry.preview = null; entry.shown = false; entry.error = what(e);
    }
    this.refreshRow(row); this.showStatus(); this.publish(entry.preview !== null);
  }

  togglePreview(id: number): void {
    this.selectConnector(id);
    const row = this.currentRow;
    if (row < 0 || this.#entries[row].definition.id !== id) return;
    const entry = this.#entries[row];
    if (!entry.shown) { this.testSelection(); return; }
    entry.shown = false;
    this.refreshRow(row); this.showStatus(); this.publish();
  }

  exitPreview(): void {
    this.renamePoint();
    for (let row = 0; row < this.#entries.length; ++row) {
      this.#entries[row].shown = false;
      this.refreshRow(row);
    }
    this.publish();
  }

  renamePoint(): void {
    const row = this.currentRow;
    if (this.#loading || row < 0 || row >= this.#entries.length) return;
    const entry = this.#entries[row];
    const name = trimmed(this.pointText);
    if (name === entry.definition.pointName) return;
    const duplicate = this.#entries.some((other) =>
      other.definition.id !== entry.definition.id && other.definition.pointName === name);
    if (name === '' || duplicate) {
      this.#setPointText(entry.definition.pointName);
      entry.error = name === '' ? 'Point name cannot be empty' : 'Point name is already used';
      this.showStatus();
      return;
    }
    entry.definition.pointName = name;
    if (entry.preview) entry.preview = { ...entry.preview, pointName: name };
    this.#setPointText(name);
    entry.error = '';
    this.refreshRow(row); this.showStatus(); this.publish();
  }

  updateRuntimeResult(result: RuntimeResult): void {
    const names: string[] = [];
    for (const request of result.parameterRequests) {
      if (request.sourceFunction !== 'get_val' || request.type === 'string') continue;
      const name = request.variableName === '' ? request.name : request.variableName;
      if (!names.includes(name)) names.push(name); // removeDuplicates()
    }
    if (!sameArray(names, this.parameterNames)) {
      this.#loading = true;
      // combo->clear(); combo->addItems(names); combo->setCurrentText(text);
      this.parameterNames = names;
      this.#loading = false;
      this.changed();
    }
    // Re-evaluate tested connectors when source/get_val values change; never leave stale geometry.
    for (let row = 0; row < this.#entries.length; ++row) {
      const entry = this.#entries[row];
      if (!entry.preview || !this.#evaluate) continue;
      try {
        entry.preview = buildConnectorPreview(entry.definition, this.#evaluate);
        entry.error = '';
      } catch (e) {
        entry.preview = null; entry.shown = false; entry.error = what(e);
      }
      this.refreshRow(row);
    }
    this.showStatus(); this.publish();
  }

  updateSizeFields(): void {
    this.circularFields = this.typeIndex === 0;
    this.changed();
  }

  refreshRow(row: number): void {
    const entry = this.#entries[row];
    const d = entry.definition;
    const position = entry.preview ? coordinates(entry.preview.point)
      : `(${d.position[0]}, ${d.position[1]}, ${d.position[2]})`;
    this.tableRows[row] = {
      id: this.tableRows[row]?.id ?? d.id, // the cell button keeps the id it was connected with
      texts: [d.name, d.pointName, d.type === 'Circular' ? 'Circular' : 'Rectangular', position],
      buttonText: entry.shown ? 'Hide' : 'Show',
    };
    this.changed();
  }

  publish(tested = false): void {
    if (!this.#previewChanged) return;
    const previews: ConnectorPreview[] = [];
    for (const entry of this.#entries) if (entry.shown && entry.preview) previews.push(entry.preview);
    const row = this.currentRow;
    const id = row >= 0 && row < this.#entries.length ? this.#entries[row].definition.id : -1;
    this.#previewChanged(previews, id, tested);
  }

  showStatus(): void {
    const row = this.currentRow;
    if (row < 0 || row >= this.#entries.length) {
      this.statusText = '';
      this.changed();
      return;
    }
    const entry = this.#entries[row];
    this.statusIsError = entry.error !== '';
    if (entry.error !== '') this.statusText = entry.error;
    else if (entry.preview) {
      const p = entry.preview;
      this.statusText = `${p.pointName} = ${coordinates(p.point)}\n`
        + `Direction = ${coordinates(p.direction)}; test length = ${formatGeneral(p.length, 8)}`;
    } else this.statusText = '';
    this.changed();
  }

  selectConnector(id: number): void {
    for (let row = 0; row < this.#entries.length; ++row) {
      if (this.#entries[row].definition.id !== id) continue;
      this.#setCurrentCell(row, 1);
      this.scrollRequest = { row, serial: ++this.#scrollSerial };
      this.changed();
      return;
    }
  }

  // --- form widget signals ---------------------------------------------------------
  /** m_name textEdited */
  nameEdited(text: string): void { this.nameText = text; this.changed(); this.saveSelection(); }

  /** m_point text edited (no slot; renamed on editingFinished). */
  pointEdited(text: string): void {
    this.pointText = text;
    this.#pointEditedSinceFinished = true;
    this.changed();
  }

  /** QLineEdit::editingFinished: Return, or focus loss after a modification. */
  pointEditingFinished(returnPressed: boolean): void {
    if (!returnPressed && !this.#pointEditedSinceFinished) return;
    this.#pointEditedSinceFinished = false;
    this.renamePoint();
  }

  #setPointText(text: string): void {
    this.pointText = text;
    this.#pointEditedSinceFinished = false;
    this.changed();
  }

  /** m_type currentIndexChanged */
  typeChanged(index: number): void {
    if (index === this.typeIndex) return;
    this.typeIndex = index;
    this.updateSizeFields(); this.saveSelection();
  }

  /** m_diameter / m_aSize / m_bSize currentTextChanged */
  sizeTextChanged(field: SizeField, text: string): void {
    if (this.sizeTexts[field] === text) return;
    this.sizeTexts = { ...this.sizeTexts, [field]: text };
    this.changed();
    this.saveSelection();
  }

  /** m_position[i] textEdited */
  positionEdited(index: number, text: string): void {
    this.positionTexts = [...this.positionTexts];
    this.positionTexts[index] = text;
    this.changed();
    this.saveSelection();
  }

  /** m_angles[i] textEdited */
  angleEdited(index: number, text: string): void {
    this.angleTexts = [...this.angleTexts];
    this.angleTexts[index] = text;
    this.changed();
    this.saveSelection();
  }

  /** m_orientation idClicked (exclusive checkable buttons). */
  orientationClicked(id: number): void {
    this.orientationId = id;
    this.changed();
    this.saveSelection();
  }
}
