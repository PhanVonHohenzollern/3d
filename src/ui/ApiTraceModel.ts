// Port of the logic of ui/ApiTracePanel.{h,cpp}. ApiTracePanel owns API
// selection and focus; ApiTracePanel.tsx renders this model (the tree, the
// Clear API Focus button and the Earlier values window).
//
// Only explicit expansion loads trace rows (m_pendingTraceRows); expanded
// branches and selected rows are retained across setRuntimeResult() by node key.

import { apiParameterMetadataForCall, type ApiParameterMetadata } from '../runtime/ApiMetadata';
import { apiParameterRole } from '../runtime/ApiSemantics';
import { runtimeSourceHistory } from '../runtime/GeometryRuntime';
import {
  emptyRuntimeResult, type RuntimeApiCall, type RuntimeArgumentTrace, type RuntimeResult, type RuntimeValueSource,
  type RuntimeVariableChange,
} from '../runtime/RuntimeTypes';
import {
  isArray, isPoint, isVector, runtimeTypeName, runtimeValueToCompactString, type RuntimeValue,
} from '../runtime/RuntimeValue';
import { apiDebugItemId } from '../renderer/Viewport3DHandle';
import { ApiHistoryDialogModel } from './ApiHistoryModel';
import { Observable } from './Observable';
import { changeExpression, directSource, displayExpression } from './TraceFormatting';
import { TreeWidget, TreeWidgetItem, UserRole, type TreeMouseEvent } from './TreeWidget';

const kDebugItemRole = UserRole + 1;
const kNodeKeyRole = UserRole + 3;
const kSourceLineRole = UserRole + 4;
const kParameterRole = UserRole + 5;
const kArraySummaryRole = UserRole + 6;
export const TraceColumn = {
  Number: 0, Name: 1, Type: 2, Expression: 3, Value: 4, X: 5, Y: 6, Z: 7, Role: 8, Line: 9, ColumnCount: 10,
} as const;
const { Number: NumberColumn, Name, Type, Expression, Value, X, Y, Z, Role, Line, ColumnCount } = TraceColumn;

/** Selected trace cells use bold QColor(255,228,160) text. */
const kSelectedForeground = '#ffe4a0';

/**
 * TraceTree: Shift-click selects the visible row span from a persistent
 * anchor, because formatting selected rows can reset Qt's internal range anchor.
 */
class TraceTree extends TreeWidget {
  #anchor: TreeWidgetItem | null = null;
  #rangePress = false;

  override mousePressEvent(event: TreeMouseEvent): void {
    const index = event.item;
    const anchor = this.#anchor && this.#anchor.treeWidget() === this ? this.#anchor : null;
    this.#rangePress = event.modifiers.shift && !!anchor && !!index
      && this.isItemVisible(anchor) && this.isItemVisible(index);
    if (this.#rangePress) {
      // Keep a persistent source index and select the visible row span.
      this.setCurrentNoUpdate(index);
      this.selectVisualRange(anchor!, index!, event.modifiers.control ? 'Select' : 'ClearAndSelect');
    } else {
      super.mousePressEvent(event);
      this.#anchor = index;
    }
  }

  override mouseReleaseEvent(event: TreeMouseEvent): void {
    if (!this.#rangePress) { super.mouseReleaseEvent(event); return; }
    this.#rangePress = false;
    if (event.item) this.emitSignal(this.itemClicked, event.item, event.column);
  }
}

function setValue(item: TreeWidgetItem, value: RuntimeValue): void {
  item.setText(Type, runtimeTypeName(value));
  const coordinates = (x: number, y: number, z: number) => {
    item.setText(X, runtimeValueToCompactString(x));
    item.setText(Y, runtimeValueToCompactString(y));
    item.setText(Z, runtimeValueToCompactString(z));
  };
  if (isPoint(value)) coordinates(value.x, value.y, value.z);
  else if (isVector(value)) coordinates(value.x, value.y, value.z);
  else if (isArray(value)) {
    const summary = runtimeValueToCompactString(value);
    item.setData(0, kArraySummaryRole, summary);
    item.setText(Value, item.isExpanded() ? '' : summary);
  } else item.setText(Value, runtimeValueToCompactString(value));
}

function setLine(item: TreeWidgetItem, line: number): void {
  item.setData(0, kSourceLineRole, line);
  if (line > 0) item.setText(Line, String(line));
}

function updateArraySummary(item: TreeWidgetItem): void {
  if (item.hasData(0, kArraySummaryRole))
    item.setText(Value, item.isExpanded() ? '' : item.dataString(0, kArraySummaryRole));
}

function otherInputs(change: RuntimeVariableChange): RuntimeValueSource[] {
  const inputs: RuntimeValueSource[] = [];
  for (const source of change.sources)
    if (source.name !== change.name || source.variableId !== change.variableId) inputs.push(source);
  return inputs;
}

/** QString::remove("const ") / remove('&') followed by trimmed(). */
function metadataTypeText(type: string): string {
  return type.split('const ').join('').split('&').join('').trim();
}

/** The subset of ApiTracePanel's public interface MainWindow uses. */
export interface ApiTracePanelHandle {
  setPlaceholderData(): void;
  setRuntimeResult(result: RuntimeResult): void;
  selectMeshApiCall(apiIndex: number): void;
  meshApiCall(): number;
  selectDebugItems(names: ReadonlySet<string>): void;
  clearApiFocus(): void;
  selectedApiCall(): number;
  selectedDebugItems(): Set<string>;
  selectedApiCalls(): Set<number>;
  selectedSourceLines(): Set<number>;
}

export class ApiTracePanelModel extends Observable implements ApiTracePanelHandle {
  readonly m_tree: TreeWidget = new TraceTree();
  #historyDialog: ApiHistoryDialogModel | null = null;
  #selectedApiIndex = -1;
  #meshApiIndex = -1;
  #selectionChangedCallback: ((apiIndex: number) => void) | null = null;
  #runtimeResult: RuntimeResult = emptyRuntimeResult();
  readonly #pendingTraceRows = new Map<TreeWidgetItem, () => void>();
  #sourceActivatedCallback: ((line: number) => void) | null = null;
  #historySourceActivatedCallback: ((line: number) => void) | null = null;

  constructor() {
    super();
    const tree = this.m_tree;
    tree.setColumnCount(ColumnCount);
    tree.setHeaderLabels(['#', 'Parameter / Variable', 'Type', 'Expression', 'Value', 'X', 'Y', 'Z', 'Role', 'Line']);
    tree.setColumnResizeToContents(NumberColumn, true);
    tree.setColumnWidth(NumberColumn, 60);
    tree.setColumnWidth(Name, 235);
    tree.setColumnWidth(Type, 135);
    tree.setColumnWidth(Expression, 340);
    tree.setColumnWidth(Value, 210);
    for (let c = X; c <= Z; ++c) tree.setColumnWidth(c, 85);
    tree.setColumnWidth(Role, 230);
    tree.setColumnWidth(Line, 65);
    tree.setExpandsOnDoubleClick(false);
    tree.itemExpanded.connect((item) => {
      this.#populateTrace(item);
      updateArraySummary(item);
      if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.#selectedApiIndex);
    });
    tree.itemCollapsed.connect((item) => updateArraySummary(item));
    tree.itemClicked.connect((item) => {
      const line = item.dataInt(0, kSourceLineRole);
      if (line > 0 && this.#sourceActivatedCallback) this.#sourceActivatedCallback(line);
    });
    tree.itemDoubleClicked.connect((item) => {
      this.#showApiHistory(item.dataInt(0, UserRole));
    });
    tree.itemSelectionChanged.connect(() => {
      const selected = tree.selectedItems();
      const current = tree.currentItem();
      if (current && current.isSelected()) this.#selectedApiIndex = current.dataInt(0, UserRole);
      else if (selected.length) this.#selectedApiIndex = selected[0].dataInt(0, UserRole);
      this.#updateSelectionAppearance();
      if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.#selectedApiIndex);
    });
  }

  /** The "Clear API Focus" tool button. */
  clearFocusClicked(): void { this.clearApiFocus(); }

  /** The Earlier values window, if open (QPointer<ApiHistoryDialog>). */
  historyDialog(): ApiHistoryDialogModel | null { return this.#historyDialog; }

  setPlaceholderData(): void { this.setRuntimeResult(emptyRuntimeResult()); }

  #appendParameter(parent: TreeWidgetItem, call: RuntimeApiCall, apiIndex: number, parameter: number,
    formal: string, value: RuntimeValue, trace: RuntimeArgumentTrace, indices: number[] = []): void {
    const item = new TreeWidgetItem(parent);
    item.setData(0, UserRole, apiIndex);
    item.setData(0, kNodeKeyRole, `api:${apiIndex}/parameter:${formal}`);
    item.setData(0, kParameterRole, formal);
    item.setText(Name, formal);
    item.setText(Expression, displayExpression(trace.expression, value));
    item.setText(Role, apiParameterRole(call, parameter, indices));
    setValue(item, value);
    if (indices.length === 0 && !isArray(value)) {
      const metadata = apiParameterMetadataForCall(call);
      if (!call.userFunctionCall && parameter < metadata.length) item.setText(Type, metadataTypeText(metadata[parameter].type));
    }
    const point = isPoint(value);
    const vector = isVector(value);
    if (point || vector) item.setData(0, kDebugItemRole, apiDebugItemId(apiIndex, point ? 'point' : 'vector', formal));
    const source = directSource(trace, value);
    let line = 0;
    if (source) {
      const history = runtimeSourceHistory(this.#runtimeResult, source);
      if (history.length) line = this.#runtimeResult.variableChanges[history[history.length - 1]].line;
    }
    setLine(item, line);
    if (isArray(value) && indices.length < 4) {
      if (trace.expression === formal) item.setText(Expression, '');
      for (let i = 0; i < value.elements.length; ++i) {
        const path = [...indices, i];
        const childTrace = i < trace.elements.length ? trace.elements[i]
          : { expression: `${trace.expression}[${i}]`, sources: [], elements: [] };
        this.#appendParameter(item, call, apiIndex, parameter, `${formal}[${i}]`, value.elements[i], childTrace, path);
      }
      if (indices.length && source) item.setText(Name, source.name);
    } else if (source) {
      // One row per value: the formal array index is kept as selection
      // metadata; the visible row is its source variable and assignment.
      this.#configureSource(item, source);
      item.setText(Name, indices.length === 0 && formal !== source.name ? `${formal} (${source.name})` : source.name);
    } else if (trace.sources.length) {
      this.#setTraceChildren(item, trace.sources);
    }
  }

  setRuntimeResult(result: RuntimeResult): void {
    if (this.#historyDialog) { this.#historyDialog.close(); this.#historyDialog = null; }
    const tree = this.m_tree;
    const previous = this.#selectedApiIndex;
    const currentItem = tree.currentItem();
    const previousNode = currentItem ? currentItem.dataString(0, kNodeKeyRole) : '';
    const expandedNodes = new Set<string>();
    const selectedNodes = new Set<string>();
    for (const item of tree.allItems()) {
      if (item.isExpanded()) expandedNodes.add(item.dataString(0, kNodeKeyRole));
      if (item.isSelected()) selectedNodes.add(item.dataString(0, kNodeKeyRole));
    }
    const blocked = tree.blockSignals(true); // QSignalBlocker blocker(m_tree);
    this.#clearMeshFilter();
    this.#pendingTraceRows.clear(); tree.clear();
    this.#runtimeResult = result;
    const apiItems: TreeWidgetItem[] = [];
    for (let i = 0; i < result.apiCalls.length; ++i) {
      const call = result.apiCalls[i];
      const item = call.parentApiIndex >= 0 && call.parentApiIndex < i
        ? new TreeWidgetItem(apiItems[call.parentApiIndex]) : new TreeWidgetItem(tree);
      apiItems[i] = item;
      item.setData(0, UserRole, i);
      item.setData(0, kNodeKeyRole, `api:${i}`);
      item.setText(NumberColumn, String(i + 1)); item.setText(Name, call.name);
      item.setText(Type, call.userFunctionCall ? 'C++' : 'API');
      item.setText(Expression, call.display);
      setLine(item, call.line);
      let metadata: ApiParameterMetadata[] = apiParameterMetadataForCall(call);
      if (call.userFunctionCall) {
        metadata = [];
        for (let p = 0; p < call.formalParameterNames.length; ++p)
          metadata.push({ name: call.formalParameterNames[p],
            type: p < call.formalParameterTypes.length ? call.formalParameterTypes[p] : '', defaultValue: '' });
      }
      for (let p = 0; p < call.arguments.length; ++p) {
        const trace: RuntimeArgumentTrace = p < call.argumentTraces.length
          ? { ...call.argumentTraces[p] } : { expression: '', sources: [], elements: [] };
        if (trace.expression === '' && p < call.argumentExpressions.length) trace.expression = call.argumentExpressions[p];
        this.#appendParameter(item, call, i, p, p < metadata.length ? metadata[p].name : `arg${p}`, call.arguments[p], trace);
      }
      for (let p = call.arguments.length; p < metadata.length; ++p) {
        if (metadata[p].defaultValue === '') continue;
        const child = new TreeWidgetItem(item);
        child.setData(0, UserRole, i);
        child.setData(0, kNodeKeyRole, `api:${i}/default:${metadata[p].name}`);
        child.setText(Name, metadata[p].name); child.setText(Type, metadata[p].type);
        child.setText(Value, metadata[p].defaultValue); child.setText(Role, 'Default argument');
      }
    }
    let selection: TreeWidgetItem | null = null;
    const expandedList = [...expandedNodes];
    const selectedList = [...selectedNodes];
    for (const item of tree.allItems()) {
      const key = item.dataString(0, kNodeKeyRole);
      const prefix = `${key}/`;
      if (key === previousNode) selection = item;
      const expanded = expandedNodes.has(key);
      if (expanded || previousNode.startsWith(prefix)
        || selectedList.some((s) => s.startsWith(prefix))
        || expandedList.some((s) => s.startsWith(prefix))) this.#populateTrace(item);
      item.setExpanded(expanded);
      updateArraySummary(item);
      item.setSelected(selectedNodes.has(key));
    }
    if (!selection && previous >= 0 && previous < apiItems.length) selection = apiItems[previous];
    this.#selectedApiIndex = selection ? selection.dataInt(0, UserRole) : -1;
    if (selection) tree.setCurrentItem(selection, 0, 'NoUpdate');
    this.#updateSelectionAppearance();
    tree.blockSignals(blocked); // blocker.unblock();
    this.changed();
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.#selectedApiIndex);
  }

  #populateTrace(item: TreeWidgetItem): void {
    const populate = this.#pendingTraceRows.get(item);
    if (!populate) return;
    this.#pendingTraceRows.delete(item);
    populate();
    item.setChildIndicatorPolicy('DontShowIndicatorWhenChildless');
  }

  #appendTraceSources(parent: TreeWidgetItem, sources: readonly RuntimeValueSource[]): void {
    for (let i = 0; i < sources.length; ++i) {
      const source = sources[i];
      const item = new TreeWidgetItem(parent);
      item.setData(0, UserRole, parent.data(0, UserRole));
      item.setData(0, kNodeKeyRole, `${parent.dataString(0, kNodeKeyRole)}/source:${i}:${source.name}`);
      item.setText(Name, source.name); setValue(item, source.value);
      item.setText(Role, 'Source variable');
      this.#configureSource(item, source);
      const array = source.value;
      if (isArray(array)) {
        item.setChildIndicatorPolicy('ShowIndicator');
        this.#pendingTraceRows.set(item, () => {
          const children: RuntimeValueSource[] = [];
          for (let j = 0; j < array.elements.length; ++j)
            children.push({ name: `${source.name}[${j}]`, value: array.elements[j],
              variableId: source.variableId, historyEnd: source.historyEnd });
          this.#appendTraceSources(item, children);
        });
      }
    }
  }

  #configureSource(item: TreeWidgetItem, source: RuntimeValueSource): void {
    const history = runtimeSourceHistory(this.#runtimeResult, source);
    let expression = '';
    let line = 0;
    let dependencies: RuntimeValueSource[] = [];
    if (history.length) {
      const change = this.#runtimeResult.variableChanges[history[history.length - 1]];
      expression = changeExpression(change);
      line = change.line;
      dependencies = otherInputs(change);
      // Keep member writes explicit rather than presenting a component's RHS
      // as the initializer of the entire point/vector.
      if (change.name !== source.name) expression = `${change.name} = ${expression}`;
    }
    item.setText(Expression, displayExpression(expression, source.value));
    setLine(item, line);
    this.#setTraceChildren(item, dependencies);
  }

  #setTraceChildren(item: TreeWidgetItem, dependencies: readonly RuntimeValueSource[]): void {
    if (!dependencies.length) return;
    item.setChildIndicatorPolicy('ShowIndicator');
    this.#pendingTraceRows.set(item, () => this.#appendTraceSources(item, dependencies));
  }

  #showApiHistory(apiIndex: number): void {
    if (apiIndex < 0 || apiIndex >= this.#runtimeResult.apiCalls.length) return;
    if (this.#historyDialog && this.#historyDialog.apiIndex() !== apiIndex) {
      this.#historyDialog.close(); this.#historyDialog = null;
    }
    if (!this.#historyDialog) {
      const dialog = new ApiHistoryDialogModel(this.#runtimeResult, apiIndex);
      dialog.setSourceActivatedCallback((line) => {
        if (this.#historySourceActivatedCallback) this.#historySourceActivatedCallback(line);
      });
      // WA_DeleteOnClose + QPointer: a closed dialog reads back as null.
      dialog.onClosed(() => {
        if (this.#historyDialog === dialog) this.#historyDialog = null;
        this.changed();
      });
      this.#historyDialog = dialog;
    }
    this.#historyDialog.showAndRaise();
    this.changed();
  }

  setSelectionChangedCallback(callback: ((apiIndex: number) => void) | null): void { this.#selectionChangedCallback = callback; }
  setSourceActivatedCallback(callback: ((line: number) => void) | null): void { this.#sourceActivatedCallback = callback; }
  setHistorySourceActivatedCallback(callback: ((line: number) => void) | null): void { this.#historySourceActivatedCallback = callback; }

  selectMeshApiCall(apiIndex: number): void {
    const tree = this.m_tree;
    let call: TreeWidgetItem | null = null;
    for (const item of tree.allItems()) {
      if (item.dataString(0, kNodeKeyRole) === `api:${apiIndex}`) { call = item; break; }
    }
    if (!call) { this.clearApiFocus(); return; }
    const blocked = tree.blockSignals(true);
    this.#clearMeshFilter();
    this.#meshApiIndex = apiIndex;
    const ancestors = new Set<TreeWidgetItem>();
    for (let parent = call.parent(); parent; parent = parent.parent()) ancestors.add(parent);
    // Keep original call indices and captured values, including loop iterations.
    // For a nested helper, start at its parent so only the mesh's own API appears.
    for (const item of tree.allItems())
      item.setHidden(item.dataInt(0, UserRole) !== apiIndex && !ancestors.has(item));
    tree.setRootItem(call.parent());
    tree.setCurrentItem(call, 0, 'ClearAndSelect');
    this.#selectedApiIndex = apiIndex;
    this.#updateSelectionAppearance();
    tree.scrollToItem(call);
    this.changed();
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(apiIndex);
    tree.blockSignals(blocked);
  }

  meshApiCall(): number { return this.#meshApiIndex; }

  #clearMeshFilter(): void {
    if (this.#meshApiIndex < 0) return;
    this.#meshApiIndex = -1;
    this.m_tree.setRootItem(null);
    for (const item of this.m_tree.allItems()) item.setHidden(false);
  }

  selectDebugItems(names: ReadonlySet<string>): void {
    const tree = this.m_tree;
    const previous = this.selectedDebugItems();
    const blocked = tree.blockSignals(true);
    tree.clearSelection();
    let current: TreeWidgetItem | null = null;
    for (const item of tree.allItems()) {
      const id = item.dataString(0, kDebugItemRole);
      if (!names.has(id)) continue;
      for (let p = item.parent(); p; p = p.parent()) {
        p.setExpanded(true);
        updateArraySummary(p);
      }
      item.setSelected(true);
      if (!current || !previous.has(id)) current = item;
    }
    tree.setCurrentItem(current, 0, 'NoUpdate');
    if (current) {
      this.#selectedApiIndex = current.dataInt(0, UserRole);
      tree.scrollToItem(current);
    }
    this.#updateSelectionAppearance();
    this.changed();
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(this.#selectedApiIndex);
    const line = current ? current.dataInt(0, kSourceLineRole) : 0;
    if (line > 0 && this.#sourceActivatedCallback) this.#sourceActivatedCallback(line);
    tree.blockSignals(blocked);
  }

  #updateSelectionAppearance(): void {
    for (const item of this.m_tree.allItems()) {
      for (let column = 0; column < ColumnCount; ++column) {
        item.setBold(column, item.isSelected());
        item.setForeground(column, item.isSelected() ? kSelectedForeground : undefined);
      }
    }
  }

  selectedDebugItems(): Set<string> {
    const ids = new Set<string>();
    const collect = (item: TreeWidgetItem): void => {
      const id = item.dataString(0, kDebugItemRole);
      if (id !== '') { ids.add(id); return; }
      for (let i = 0; i < item.childCount(); ++i) collect(item.child(i));
    };
    for (const selected of this.m_tree.selectedItems()) {
      for (let item: TreeWidgetItem | null = selected; item; item = item.parent()) {
        if (item.dataString(0, kParameterRole) === '') continue;
        collect(item); break;
      }
    }
    return ids;
  }

  selectedApiCalls(): Set<number> {
    const indices = new Set<number>();
    for (const item of this.m_tree.selectedItems()) indices.add(item.dataInt(0, UserRole));
    if (indices.size === 0 && this.#selectedApiIndex >= 0) indices.add(this.#selectedApiIndex);
    return indices;
  }

  selectedSourceLines(): Set<number> {
    const lines = new Set<number>();
    for (const item of this.m_tree.selectedItems()) {
      const line = item.dataInt(0, kSourceLineRole);
      if (line > 0) lines.add(line);
    }
    return lines;
  }

  clearApiFocus(): void {
    const tree = this.m_tree;
    const blocked = tree.blockSignals(true);
    this.#clearMeshFilter();
    tree.clearSelection(); tree.setCurrentItem(null); this.#selectedApiIndex = -1;
    this.#updateSelectionAppearance();
    this.changed();
    if (this.#selectionChangedCallback) this.#selectionChangedCallback(-1);
    tree.blockSignals(blocked);
  }

  selectedApiCall(): number { return this.#selectedApiIndex; }
}
