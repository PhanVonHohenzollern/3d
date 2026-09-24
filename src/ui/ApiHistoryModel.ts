// Port of the logic of ui/ApiHistoryDialog.{h,cpp}: the modeless "Earlier
// values" window for all parameters of one immutable API call snapshot.
// ApiHistoryDialog.tsx renders it as a floating window.

import { apiParameterMetadataForCall } from '../runtime/ApiMetadata';
import { runtimeSourceHistory } from '../runtime/GeometryRuntime';
import type { RuntimeArgumentTrace, RuntimeResult, RuntimeValueSource } from '../runtime/RuntimeTypes';
import { isArray, isUnset, runtimeTypeName, runtimeValueToCompactString, type RuntimeValue } from '../runtime/RuntimeValue';
import { Observable } from './Observable';
import { directSource, displayExpression } from './TraceFormatting';
import { TreeWidget, TreeWidgetItem, UserRole } from './TreeWidget';

export const HistoryColumn = {
  Parameter: 0, Variable: 1, Type: 2, Expression: 3, Before: 4, Value: 5, Line: 6, State: 7,
} as const;
const ColumnCount = 8;
const { Parameter, Variable, Type, Expression, Before, Value, Line, State } = HistoryColumn;
const kSourceLineRole = UserRole + 1;
const kArraySummaryRole = UserRole + 2;

function valueText(value: RuntimeValue): string {
  return isUnset(value) ? '\u2014' : runtimeValueToCompactString(value);
}

function setCurrentSource(row: TreeWidgetItem, result: RuntimeResult, value: RuntimeValue, trace: RuntimeArgumentTrace): number {
  let expression = trace.expression;
  const direct = directSource(trace, value);
  // Computed inputs keep their actual expression (e.g. -vCr). When there is
  // one source variable, it still supplies a definition to navigate to.
  const source = direct ?? (trace.sources.length === 1 ? trace.sources[0] : null);
  let line = 0;
  if (source) {
    const history = runtimeSourceHistory(result, source);
    if (history.length) {
      const change = result.variableChanges[history[history.length - 1]];
      line = change.line;
      if (direct && !isArray(value)) {
        expression = change.expression;
        if (change.operation === '+=' || change.operation === '-=' || change.operation === '*=' || change.operation === '/=')
          expression = `${change.name}${change.operation.slice(0, 1)}(${expression})`;
        if (change.name !== direct.name) expression = `${change.name} = ${expression}`;
      }
    }
  }
  row.setText(Expression, displayExpression(expression, value));
  if (line > 0) row.setText(Line, String(line));
  return line;
}

function updateArraySummary(row: TreeWidgetItem): void {
  if (row.hasData(0, kArraySummaryRole))
    row.setText(Value, row.isExpanded() ? '' : row.dataString(0, kArraySummaryRole));
}

/**
 * Indices of earlier variable changes behind `sources`, newest first. The
 * latest assignment of each source supplies the already displayed value.
 */
export function earlierChanges(result: RuntimeResult, sources: readonly RuntimeValueSource[]): number[] {
  const changes = new Set<number>();
  const visited = new Set<string>();
  const pending = [...sources];
  while (pending.length) {
    const source = pending.pop()!;
    const key = JSON.stringify([source.variableId, source.name, source.historyEnd]);
    if (visited.has(key)) continue;
    visited.add(key);
    const history = runtimeSourceHistory(result, source);
    // Keep all earlier writes, and follow immutable dependencies from every write.
    for (let i = 0; i < history.length; ++i) {
      if (i + 1 < history.length) changes.add(history[i]);
      pending.push(...result.variableChanges[history[i]].sources);
    }
  }
  return [...changes].sort((a, b) => b - a);
}

function addParameter(parent: TreeWidgetItem, result: RuntimeResult, name: string,
  value: RuntimeValue, trace: RuntimeArgumentTrace): void {
  const row = new TreeWidgetItem(parent);
  row.setText(Parameter, name);
  row.setText(Type, runtimeTypeName(value));
  const sourceLine = setCurrentSource(row, result, value, trace);
  row.setText(Value, valueText(value));
  row.setText(State, 'At API call');
  const variables: string[] = [];
  for (const source of trace.sources)
    if (!variables.includes(source.name)) variables.push(source.name);
  row.setText(Variable, variables.join(', '));

  if (isArray(value)) {
    for (let i = 0; i < value.elements.length; ++i) {
      let element: RuntimeArgumentTrace;
      if (i < trace.elements.length) element = trace.elements[i];
      else {
        element = { expression: `${trace.expression}[${i}]`, sources: [], elements: [] };
        // Preserve the captured lifetime/boundary if old data has no
        // separate element trace. Never consult current runtime values.
        for (const source of trace.sources) {
          const sourceArray = source.value;
          if (isArray(sourceArray) && i < sourceArray.elements.length)
            element.sources.push({ name: `${source.name}[${i}]`, value: sourceArray.elements[i],
              variableId: source.variableId, historyEnd: source.historyEnd });
        }
      }
      addParameter(row, result, `${name}[${i}]`, value.elements[i], element);
    }
    row.setData(0, kArraySummaryRole, valueText(value));
    // The array itself has a source even when its elements have no earlier
    // writes. Do not mistake element rows for historical assignments.
    row.setData(0, kSourceLineRole, sourceLine);
  } else {
    const changes = earlierChanges(result, trace.sources);
    for (const index of changes) {
      const change = result.variableChanges[index];
      const entry = new TreeWidgetItem(row);
      entry.setData(0, UserRole, index);
      entry.setData(0, kSourceLineRole, change.line);
      entry.setText(Variable, change.name);
      entry.setText(Type, runtimeTypeName(change.after));
      entry.setText(Expression, change.expression);
      entry.setText(Before, valueText(change.before));
      entry.setText(Value, valueText(change.after));
      if (change.line > 0) entry.setText(Line, String(change.line));
      entry.setText(State, change.operation === 'declare' ? 'Initialization' : change.operation);
    }
    if (!changes.length) {
      row.setText(State, 'No earlier values');
      row.setData(0, kSourceLineRole, sourceLine);
    }
  }
  row.setBold(Parameter, true);
  row.setExpanded(true);
  updateArraySummary(row);
}

export class ApiHistoryDialogModel extends Observable {
  readonly #apiIndex: number;
  readonly windowTitle: string;
  /** Caption label: the call's display text (plain, selectable, word-wrapped). */
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
    if (!call) throw new RangeError(`vector::_M_range_check: __n (which is ${apiIndex}) >= this->size() (which is ${result.apiCalls.length})`);
    this.windowTitle = `Earlier values - API #${apiIndex + 1} ${call.name} - line ${call.line}`;
    this.caption = call.display;
    const tree = this.tree;
    tree.setColumnCount(ColumnCount);
    tree.setHeaderLabels(['Parameter', 'Variable', 'Type', 'Expression', 'Before', 'Value / After', 'Line', 'State']);
    tree.setExpandsOnDoubleClick(false);
    tree.itemExpanded.connect(updateArraySummary);
    tree.itemCollapsed.connect(updateArraySummary);
    tree.itemDoubleClicked.connect((item) => {
      const line = item.dataInt(0, kSourceLineRole);
      if (line > 0 && this.#sourceActivatedCallback) this.#sourceActivatedCallback(line);
    });
    const widths = [185, 180, 110, 300, 180, 180, 65, 135];
    for (let column = 0; column < ColumnCount; ++column) tree.setColumnWidth(column, widths[column]);
    const metadata = apiParameterMetadataForCall(call);
    for (let i = 0; i < call.arguments.length; ++i) {
      const name = call.userFunctionCall && i < call.formalParameterNames.length
        ? call.formalParameterNames[i] : i < metadata.length ? metadata[i].name : `arg${i}`;
      const trace: RuntimeArgumentTrace = i < call.argumentTraces.length
        ? { ...call.argumentTraces[i] } : { expression: '', sources: [], elements: [] };
      if (trace.expression === '' && i < call.argumentExpressions.length) trace.expression = call.argumentExpressions[i];
      addParameter(tree.invisibleRootItem(), result, name, call.arguments[i], trace);
    }
    for (let i = call.arguments.length; i < metadata.length; ++i) {
      if (metadata[i].defaultValue === '') continue;
      const row = new TreeWidgetItem(tree);
      row.setText(Parameter, metadata[i].name);
      row.setText(Type, metadata[i].type);
      row.setText(Value, metadata[i].defaultValue);
      row.setText(State, 'Default argument');
    }
  }

  apiIndex(): number { return this.#apiIndex; }
  setSourceActivatedCallback(callback: ((line: number) => void) | null): void { this.#sourceActivatedCallback = callback; }

  // --- window lifecycle (QDialog with WA_DeleteOnClose) ----------------------
  isOpen(): boolean { return this.#open; }
  /** show(); raise(); activateWindow(); */
  showAndRaise(): void {
    ++this.#raiseSerial;
    this.changed();
  }
  raiseSerial(): number { return this.#raiseSerial; }
  /** QWidget::close(); the dialog deletes itself, so QPointer owners see null. */
  close(): void {
    if (!this.#open) return;
    this.#open = false;
    this.changed();
    for (const listener of [...this.#closedListeners]) listener();
  }
  onClosed(listener: () => void): void { this.#closedListeners.push(listener); }
}
