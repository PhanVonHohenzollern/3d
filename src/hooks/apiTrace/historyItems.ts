import { runtimeSourceHistory } from '../../core/runtime/GeometryRuntime';
import type { RuntimeArgumentTrace, RuntimeResult } from '../../core/runtime/RuntimeTypes';
import { isArray, runtimeTypeName, type RuntimeValue } from '../../core/runtime/RuntimeValue';
import { earlierChanges, historyValueText } from '../../helpers/apiHistory';
import { compoundExpression, directSource, displayExpression } from '../../helpers/traceFormatting';
import { UserRole } from '../treeWidget/TreeWidget';
import { TreeWidgetItem } from '../treeWidget/TreeWidgetItem';

export const HistoryColumn = {
  Parameter: 0,
  Variable: 1,
  Type: 2,
  Expression: 3,
  Before: 4,
  Value: 5,
  Line: 6,
  State: 7,
} as const;
export const kHistoryColumnCount = 8;
export const kHistoryHeaderLabels = [
  'Parameter',
  'Variable',
  'Type',
  'Expression',
  'Before',
  'Value / After',
  'Line',
  'State',
];
export const kHistoryColumnWidths = [185, 180, 110, 300, 180, 180, 65, 135];
const { Parameter, Variable, Type, Expression, Before, Value, Line, State } = HistoryColumn;
export const kHistorySourceLineRole = UserRole + 1;
const kArraySummaryRole = UserRole + 2;

function setCurrentSource(
  row: TreeWidgetItem,
  result: RuntimeResult,
  value: RuntimeValue,
  trace: RuntimeArgumentTrace,
): number {
  let expression = trace.expression;
  const direct = directSource(trace, value);
  const source = direct ?? (trace.sources.length === 1 ? trace.sources[0] : null);
  let line = 0;
  if (source) {
    const history = runtimeSourceHistory(result, source);
    if (history.length) {
      const change = result.variableChanges[history[history.length - 1]];
      line = change.line;
      if (direct && !isArray(value)) {
        expression = compoundExpression(change.name, change.operation, change.expression);
        if (change.name !== direct.name) expression = `${change.name} = ${expression}`;
      }
    }
  }
  row.setText(Expression, displayExpression(expression, value));
  if (line > 0) row.setText(Line, String(line));
  return line;
}

export function updateHistoryArraySummary(row: TreeWidgetItem): void {
  if (row.hasData(0, kArraySummaryRole))
    row.setText(Value, row.isExpanded() ? '' : row.dataString(0, kArraySummaryRole));
}

export function addHistoryParameter(
  parent: TreeWidgetItem,
  result: RuntimeResult,
  name: string,
  value: RuntimeValue,
  trace: RuntimeArgumentTrace,
): void {
  const row = new TreeWidgetItem(parent);
  row.setText(Parameter, name);
  row.setText(Type, runtimeTypeName(value));
  const sourceLine = setCurrentSource(row, result, value, trace);
  row.setText(Value, historyValueText(value));
  row.setText(State, 'At API call');
  const variables: string[] = [];
  for (const source of trace.sources) if (!variables.includes(source.name)) variables.push(source.name);
  row.setText(Variable, variables.join(', '));

  if (isArray(value)) {
    for (let i = 0; i < value.elements.length; ++i) {
      let element: RuntimeArgumentTrace;
      if (i < trace.elements.length) element = trace.elements[i];
      else {
        element = { expression: `${trace.expression}[${i}]`, sources: [], elements: [] };
        for (const source of trace.sources) {
          const sourceArray = source.value;
          if (isArray(sourceArray) && i < sourceArray.elements.length)
            element.sources.push({
              name: `${source.name}[${i}]`,
              value: sourceArray.elements[i],
              variableId: source.variableId,
              historyEnd: source.historyEnd,
            });
        }
      }
      addHistoryParameter(row, result, `${name}[${i}]`, value.elements[i], element);
    }
    row.setData(0, kArraySummaryRole, historyValueText(value));
    row.setData(0, kHistorySourceLineRole, sourceLine);
  } else {
    const changes = earlierChanges(result, trace.sources);
    for (const index of changes) {
      const change = result.variableChanges[index];
      const entry = new TreeWidgetItem(row);
      entry.setData(0, UserRole, index);
      entry.setData(0, kHistorySourceLineRole, change.line);
      entry.setText(Variable, change.name);
      entry.setText(Type, runtimeTypeName(change.after));
      entry.setText(Expression, change.expression);
      entry.setText(Before, historyValueText(change.before));
      entry.setText(Value, historyValueText(change.after));
      if (change.line > 0) entry.setText(Line, String(change.line));
      entry.setText(State, change.operation === 'declare' ? 'Initialization' : change.operation);
    }
    if (!changes.length) {
      row.setText(State, 'No earlier values');
      row.setData(0, kHistorySourceLineRole, sourceLine);
    }
  }
  row.setBold(Parameter, true);
  row.setExpanded(true);
  updateHistoryArraySummary(row);
}
