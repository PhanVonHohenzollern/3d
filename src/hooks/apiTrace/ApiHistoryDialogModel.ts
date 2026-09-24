import { apiParameterMetadataForCall } from '../../core/runtime/ApiMetadata';
import type { RuntimeArgumentTrace, RuntimeResult } from '../../core/runtime/RuntimeTypes';
import { historyWindowTitle } from '../../helpers/apiHistory';
import { Observable } from '../observable/Observable';
import { TreeWidget } from '../treeWidget/TreeWidget';
import { TreeWidgetItem } from '../treeWidget/TreeWidgetItem';
import {
  addHistoryParameter,
  HistoryColumn,
  kHistoryColumnCount,
  kHistoryColumnWidths,
  kHistoryHeaderLabels,
  kHistorySourceLineRole,
  updateHistoryArraySummary,
} from './historyItems';

let nextDialogId = 1;

export class ApiHistoryDialogModel extends Observable {
  readonly id = nextDialogId++;
  readonly #apiIndex: number;
  readonly windowTitle: string;
  readonly caption: string;
  readonly tree = new TreeWidget();
  #sourceActivatedCallback: ((line: number) => void) | null = null;
  #open = true;
  #raiseSerial = 0;
  readonly #closedListeners: (() => void)[] = [];

  constructor(result: RuntimeResult, apiIndex: number) {
    super();
    this.#apiIndex = apiIndex;
    const call = result.apiCalls[apiIndex];
    if (!call)
      throw new RangeError(
        `vector::_M_range_check: __n (which is ${apiIndex}) >= this->size() (which is ${result.apiCalls.length})`,
      );
    this.windowTitle = historyWindowTitle(apiIndex, call.name, call.line);
    this.caption = call.display;
    const tree = this.tree;
    tree.setColumnCount(kHistoryColumnCount);
    tree.setHeaderLabels(kHistoryHeaderLabels);
    tree.setExpandsOnDoubleClick(false);
    tree.itemExpanded.connect(updateHistoryArraySummary);
    tree.itemCollapsed.connect(updateHistoryArraySummary);
    tree.itemDoubleClicked.connect((item) => {
      const line = item.dataInt(0, kHistorySourceLineRole);
      if (line > 0 && this.#sourceActivatedCallback) this.#sourceActivatedCallback(line);
    });
    for (let column = 0; column < kHistoryColumnCount; ++column)
      tree.setColumnWidth(column, kHistoryColumnWidths[column]);
    const metadata = apiParameterMetadataForCall(call);
    for (let i = 0; i < call.arguments.length; ++i) {
      const name =
        call.userFunctionCall && i < call.formalParameterNames.length
          ? call.formalParameterNames[i]
          : i < metadata.length
            ? metadata[i].name
            : `arg${i}`;
      const trace: RuntimeArgumentTrace =
        i < call.argumentTraces.length ? { ...call.argumentTraces[i] } : { expression: '', sources: [], elements: [] };
      if (trace.expression === '' && i < call.argumentExpressions.length)
        trace.expression = call.argumentExpressions[i];
      addHistoryParameter(tree.invisibleRootItem(), result, name, call.arguments[i], trace);
    }
    for (let i = call.arguments.length; i < metadata.length; ++i) {
      if (metadata[i].defaultValue === '') continue;
      const row = new TreeWidgetItem(tree);
      row.setText(HistoryColumn.Parameter, metadata[i].name);
      row.setText(HistoryColumn.Type, metadata[i].type);
      row.setText(HistoryColumn.Value, metadata[i].defaultValue);
      row.setText(HistoryColumn.State, 'Default argument');
    }
  }

  apiIndex(): number {
    return this.#apiIndex;
  }

  setSourceActivatedCallback(callback: ((line: number) => void) | null): void {
    this.#sourceActivatedCallback = callback;
  }

  isOpen(): boolean {
    return this.#open;
  }

  showAndRaise(): void {
    ++this.#raiseSerial;
    this.changed();
  }

  raiseSerial(): number {
    return this.#raiseSerial;
  }

  close(): void {
    if (!this.#open) return;
    this.#open = false;
    this.changed();
    for (const listener of [...this.#closedListeners]) listener();
  }

  onClosed(listener: () => void): void {
    this.#closedListeners.push(listener);
  }
}
