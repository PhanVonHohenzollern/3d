import { describe, expect, it, vi } from 'vitest';
import type { RuntimeParameterRequest, RuntimeResult } from '../../src/core/runtime/RuntimeTypes';
import { emptyRuntimeResult } from '../../src/core/runtime/RuntimeTypes';
import { ParameterPanelModel } from '../../src/hooks/parameterPanel/ParameterPanelModel';

function request(overrides: Partial<RuntimeParameterRequest>): RuntimeParameterRequest {
  return {
    name: 'D',
    type: 'double',
    defaultValue: '',
    currentValue: '',
    sourceFunction: 'get_val',
    variableName: 'd',
    line: 1,
    ...overrides,
  };
}

function resultWith(requests: RuntimeParameterRequest[]): RuntimeResult {
  return { ...emptyRuntimeResult(), parameterRequests: requests };
}

function editValue(model: ParameterPanelModel, row: number, text: string): void {
  model.mouseDoubleClick(row, 3);
  model.editorTextEdited(text);
  model.commitEditor();
}

describe('ParameterPanel', () => {
  it('seeds values from default, current value, then the neutral value for the type', () => {
    const model = new ParameterPanelModel();
    model.setDefinitions([
      request({ name: 'A', defaultValue: '5', currentValue: '7', variableName: 'a' }),
      request({ name: 'B', defaultValue: '', currentValue: '7', variableName: 'b' }),
      request({ name: 'C', type: 'bool', variableName: 'c' }),
      request({ name: 'S', type: 'string', currentValue: 'ignored', variableName: 's' }),
      request({ name: 'I', type: 'int', variableName: 'i' }),
    ]);
    expect(Object.fromEntries(model.values())).toEqual({ A: '5', B: '7', C: 'false', S: '', I: '0' });
    expect(model.rows.map((row) => row.texts)).toEqual([
      ['A', 'double', 'a', '5', '1'],
      ['B', 'double', 'b', '7', '1'],
      ['C', 'bool', 'c', 'false', '1'],
      ['S', 'string', 's', '', '1'],
      ['I', 'int', 'i', '0', '1'],
    ]);
  });

  it('keeps user-edited values sticky while untouched source defaults follow the code', () => {
    const model = new ParameterPanelModel();
    const changed = vi.fn();
    model.setChangedCallback(changed);
    model.setDefinitions([
      request({ name: 'A', defaultValue: '5' }),
      request({ name: 'B', defaultValue: '1', variableName: 'b' }),
    ]);

    editValue(model, 0, '  12 ');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(model.values().get('A')).toBe('12');

    model.setDefinitions([
      request({ name: 'A', defaultValue: '6' }),
      request({ name: 'B', defaultValue: '2', variableName: 'b' }),
    ]);
    expect(model.values().get('A')).toBe('12');
    expect(model.values().get('B')).toBe('2');
    expect(model.rows[0].texts[3]).toBe('12');
  });

  it('only reports real edits (QTableWidgetItem::setData ignores unchanged values)', () => {
    const model = new ParameterPanelModel();
    const changed = vi.fn();
    model.setChangedCallback(changed);
    model.setDefinitions([request({ name: 'A', defaultValue: '5' })]);
    editValue(model, 0, '5');
    expect(changed).not.toHaveBeenCalled();
    expect(model.edit(0, 0)).toBe(false);
    expect(model.editor).toBeNull();
  });

  it('refines type and value from executed get_val requests, never overriding user edits', () => {
    const model = new ParameterPanelModel();
    model.setDefinitions([
      request({ name: 'A', type: 'unknown', variableName: 'a' }),
      request({ name: 'B', variableName: 'b' }),
      request({ name: 'C', variableName: 'c' }),
    ]);
    editValue(model, 2, '9');

    model.updateRuntimeResult(
      resultWith([
        request({ name: 'A', type: 'int', currentValue: '3', variableName: 'a' }),
        request({ name: 'B', currentValue: '4', variableName: 'other' }),
        request({ name: 'C', currentValue: '8', variableName: 'c' }),
        request({ name: 'A', sourceFunction: 'other', currentValue: '99', variableName: 'a' }),
      ]),
    );
    expect(model.rows.map((row) => row.texts[1])).toEqual(['int', 'double', 'double']);
    expect(Object.fromEntries(model.values())).toEqual({ A: '3', B: '0', C: '9' });
  });

  it('restores the selected row by parameter key when the table is rebuilt', () => {
    const model = new ParameterPanelModel();
    model.setDefinitions([request({ name: 'A' }), request({ name: 'B', variableName: 'b' })]);
    model.mousePress(1, 0, false);
    model.mouseRelease(1, 0);
    expect(model.selectedRow).toBe(1);
    model.setDefinitions([
      request({ name: 'X', variableName: 'x' }),
      request({ name: 'A' }),
      request({ name: 'B', variableName: 'b' }),
    ]);
    expect(model.selectedRow).toBe(2);
    expect([model.currentRow, model.currentColumn]).toEqual([2, 3]);
    model.setPlaceholderData();
    expect(model.rows).toEqual([]);
    expect(model.selectedRow).toBe(-1);
  });

  it('starts editing on a click in an already selected row (SelectedClicked)', () => {
    const model = new ParameterPanelModel();
    model.setDefinitions([request({ name: 'A', defaultValue: '1' })]);
    model.mousePress(0, 3, false);
    model.mouseRelease(0, 3);
    expect(model.editor).toBeNull();
    model.mousePress(0, 3, false);
    model.mouseRelease(0, 3);
    expect(model.editor?.text).toBe('1');
    model.revertEditor();
    expect(model.editor).toBeNull();
  });
});
