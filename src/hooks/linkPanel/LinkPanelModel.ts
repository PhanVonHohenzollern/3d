import {
  buildConnectorPreview,
  connectorOrientations,
  defaultConnectorDefinition,
  type ConnectorDefinition,
  type ConnectorExpressionEvaluator,
  type ConnectorPreview,
} from '../../core/geometry/ConnectorPreview';
import type { RuntimeResult } from '../../core/runtime/RuntimeTypes';
import {
  connectorGeometryChanged,
  connectorStatusText,
  connectorTypeIndex,
  copyDefinition,
  kConnectorTypes,
  linkParameterNames,
  linkTableTexts,
  orientationIndex,
  pointNameError,
  uniquePointName,
} from '../../helpers/link';
import { rowForKey } from '../../helpers/tableNavigation';
import type {
  LinkPanelHandle,
  LinkTableRow,
  PreviewChangedCallback,
  ScrollRequest,
  SizeField,
} from '../../types/panels';
import { sameItems } from '../../utils/arrays';
import { what } from '../../utils/cpp';
import { Observable } from '../observable/Observable';

interface Entry {
  definition: ConnectorDefinition;
  preview: ConnectorPreview | null;
  error: string;
  shown: boolean;
}

export class LinkPanelModel extends Observable implements LinkPanelHandle {
  tableRows: LinkTableRow[] = [];
  currentRow = -1;
  currentColumn = -1;
  scrollRequest: ScrollRequest | null = null;
  #scrollSerial = 0;
  #tableSignalsBlocked = false;

  formEnabled = false;
  nameText = '';
  pointText = '';
  typeIndex = 0;
  sizeTexts: Record<SizeField, string> = { diameter: '', aSize: '', bSize: '' };
  parameterNames: string[] = [];
  orientationId = 0;
  positionTexts: [string, string, string] = ['0', '0', '0'];
  angleTexts: [string, string, string] = ['0', '0', '0'];
  circularFields = true;
  statusText = '';
  statusIsError = false;
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

  setExpressionEvaluator(evaluate: ConnectorExpressionEvaluator | null): void {
    this.#evaluate = evaluate;
  }

  setPreviewChangedCallback(callback: PreviewChangedCallback | null): void {
    this.#previewChanged = callback;
  }

  definitions(): ConnectorDefinition[] {
    return this.#entries.map((entry) => copyDefinition(entry.definition));
  }

  #setCurrentCell(row: number, column: number): void {
    if (row === this.currentRow && column === this.currentColumn) return;
    this.currentRow = row;
    this.currentColumn = column;
    this.changed();
    if (!this.#tableSignalsBlocked) this.loadSelection();
  }

  cellActivated(row: number, column: number): void {
    if (row < 0 || row >= this.tableRows.length) return;
    this.#setCurrentCell(row, column);
  }

  tableKeyPress(key: string): boolean {
    const row = rowForKey(key, this.currentRow, this.tableRows.length, false);
    if (row === null) return false;
    this.#setCurrentCell(row, Math.max(this.currentColumn, 0));
    this.scrollRequest = { row: this.currentRow, serial: ++this.#scrollSerial, center: false };
    this.changed();

    return true;
  }

  addConnector(): void {
    const definition = defaultConnectorDefinition();
    definition.id = this.#nextId++;
    definition.name = `Connector ${definition.id}`;
    definition.pointName = uniquePointName(
      this.#entries.map((entry) => entry.definition),
      definition.id,
    );
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
      else {
        this.currentRow = -1;
        this.currentColumn = -1;
      }
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
      this.nameText = d.name;
      this.#setPointText(d.pointName);
      this.typeIndex = connectorTypeIndex(d.type);
      this.sizeTexts = { diameter: d.diameter, aSize: d.aSize, bSize: d.bSize };
      this.orientationId = orientationIndex(d);
      this.positionTexts = [...d.position];
      this.angleTexts = [...d.angles];
      this.#loading = false;
    }
    this.changed();
    this.updateSizeFields();
    this.showStatus();
    this.publish();
  }

  saveSelection(): void {
    const row = this.currentRow;
    if (this.#loading || row < 0 || row >= this.#entries.length) return;
    const entry = this.#entries[row];
    const d = entry.definition;
    const previous = copyDefinition(d);
    d.name = this.nameText.trim();
    d.type = kConnectorTypes[this.typeIndex];
    d.diameter = this.sizeTexts.diameter.trim();
    d.aSize = this.sizeTexts.aSize.trim();
    d.bSize = this.sizeTexts.bSize.trim();
    d.orientation = connectorOrientations[this.orientationId];
    for (let i = 0; i < 3; ++i) {
      d.position[i] = this.positionTexts[i].trim();
      d.angles[i] = this.angleTexts[i].trim();
    }
    if (connectorGeometryChanged(d, previous)) {
      entry.preview = null;
      entry.shown = false;
    } else if (entry.preview) entry.preview = { ...entry.preview, name: d.name };
    entry.error = '';
    this.refreshRow(row);
    this.showStatus();
    this.publish();
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
      entry.preview = null;
      entry.shown = false;
      entry.error = what(e);
    }
    this.refreshRow(row);
    this.showStatus();
    this.publish(entry.preview !== null);
  }

  togglePreview(id: number): void {
    this.selectConnector(id);
    const row = this.currentRow;
    if (row < 0 || this.#entries[row].definition.id !== id) return;
    const entry = this.#entries[row];
    if (!entry.shown) {
      this.testSelection();

      return;
    }
    entry.shown = false;
    this.refreshRow(row);
    this.showStatus();
    this.publish();
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
    const name = this.pointText.trim();
    if (name === entry.definition.pointName) return;
    const error = pointNameError(
      this.#entries.map((other) => other.definition),
      entry.definition.id,
      name,
    );
    if (error !== '') {
      this.#setPointText(entry.definition.pointName);
      entry.error = error;
      this.showStatus();

      return;
    }
    entry.definition.pointName = name;
    if (entry.preview) entry.preview = { ...entry.preview, pointName: name };
    this.#setPointText(name);
    entry.error = '';
    this.refreshRow(row);
    this.showStatus();
    this.publish();
  }

  updateRuntimeResult(result: RuntimeResult): void {
    const names = linkParameterNames(result);
    if (!sameItems(names, this.parameterNames)) {
      this.#loading = true;
      this.parameterNames = names;
      this.#loading = false;
      this.changed();
    }
    for (let row = 0; row < this.#entries.length; ++row) {
      const entry = this.#entries[row];
      if (!entry.preview || !this.#evaluate) continue;
      try {
        entry.preview = buildConnectorPreview(entry.definition, this.#evaluate);
        entry.error = '';
      } catch (e) {
        entry.preview = null;
        entry.shown = false;
        entry.error = what(e);
      }
      this.refreshRow(row);
    }
    this.showStatus();
    this.publish();
  }

  updateSizeFields(): void {
    this.circularFields = this.typeIndex === 0;
    this.changed();
  }

  refreshRow(row: number): void {
    const entry = this.#entries[row];
    this.tableRows[row] = {
      id: this.tableRows[row]?.id ?? entry.definition.id,
      texts: linkTableTexts(entry.definition, entry.preview),
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
    else if (entry.preview) this.statusText = connectorStatusText(entry.preview);
    else this.statusText = '';
    this.changed();
  }

  selectConnector(id: number): void {
    for (let row = 0; row < this.#entries.length; ++row) {
      if (this.#entries[row].definition.id !== id) continue;
      this.#setCurrentCell(row, 1);
      this.scrollRequest = { row, serial: ++this.#scrollSerial, center: false };
      this.changed();

      return;
    }
  }

  nameEdited(text: string): void {
    this.nameText = text;
    this.changed();
    this.saveSelection();
  }

  pointEdited(text: string): void {
    this.pointText = text;
    this.#pointEditedSinceFinished = true;
    this.changed();
  }

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

  typeChanged(index: number): void {
    if (index === this.typeIndex) return;
    this.typeIndex = index;
    this.updateSizeFields();
    this.saveSelection();
  }

  sizeTextChanged(field: SizeField, text: string): void {
    if (this.sizeTexts[field] === text) return;
    this.sizeTexts = { ...this.sizeTexts, [field]: text };
    this.changed();
    this.saveSelection();
  }

  positionEdited(index: number, text: string): void {
    this.positionTexts = [...this.positionTexts];
    this.positionTexts[index] = text;
    this.changed();
    this.saveSelection();
  }

  angleEdited(index: number, text: string): void {
    this.angleTexts = [...this.angleTexts];
    this.angleTexts[index] = text;
    this.changed();
    this.saveSelection();
  }

  orientationClicked(id: number): void {
    this.orientationId = id;
    this.changed();
    this.saveSelection();
  }
}
