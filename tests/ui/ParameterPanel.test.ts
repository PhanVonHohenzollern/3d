import { describe, expect, it, vi } from 'vitest';
import type { RuntimeParameterRequest, RuntimeResult } from '../../src/core/runtime/RuntimeTypes';
import { emptyRuntimeResult } from '../../src/core/runtime/RuntimeTypes';
import { ParameterPanelModel } from '../../src/hooks/parameterPanel/ParameterPanelModel';
import { parameterTableCells, parameterTableText } from '../../src/helpers/parameterTable';

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
  it('previews and edits a pasted table without changing active values until Apply', () => {
    const model = new ParameterPanelModel();
    const changed = vi.fn();
    model.setChangedCallback(changed);
    model.setDefinitions([request({ name: 'A', variableName: 'a', defaultValue: '5' })]);
    model.importTable('A\n10\n20');
    changed.mockClear();
    const currentData = model.dataSets;
    const currentValues = model.values();
    const cells = parameterTableCells('Wrong name\r\n40\r\n50');
    expect(() => model.previewTable(parameterTableText(cells))).toThrow('No matching parameters');
    cells[0][0] = 'A';
    cells[1][0] = '45';
    const preview = model.previewTable(parameterTableText(cells));
    expect(preview.data[0].get('A')).toBe('45');
    expect(model.dataSets).toBe(currentData);
    expect(model.values()).toEqual(currentValues);
    expect(model.pasteIsError).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    expect(model.importTable(parameterTableText(cells))).toBe(true);
    expect(model.values().get('A')).toBe('45');
    expect(model.dataSets[1].get('A')).toBe('50');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('preserves quoted text, blank optional cells and decimal commas through table preview edits', () => {
    const rows = [
      ['A', 'Label', 'Optional'],
      ['12,5', 'Fan "B"\tline 1\nline 2', ''],
    ];
    expect(parameterTableCells(parameterTableText(rows))).toEqual(rows);
  });

  it('pastes Excel rows and applies a complete row with one change notification', () => {
    const model = new ParameterPanelModel();
    const changed = vi.fn();
    model.setChangedCallback(changed);
    model.setDefinitions([
      request({ name: 'A', variableName: 'A' }),
      request({ name: 'Dw', variableName: 'Dw' }),
      request({ name: 'n', variableName: 'n', type: 'int' }),
    ]);
    expect(model.importTable('a\tdw\tn\r\n550\t500\t8\r\n610\t560\t8\r\n')).toBe(true);
    expect(Object.fromEntries(model.overrides())).toEqual({ A: '550', Dw: '500', n: '8' });
    expect(changed).toHaveBeenCalledTimes(1);
    // Repeated values such as n=8 still identify a row when selected from a combobox.
    model.selectDataSet(1);
    expect(Object.fromEntries(model.values())).toEqual({ A: '610', Dw: '560', n: '8' });
    expect(changed).toHaveBeenCalledTimes(2);
    editValue(model, 0, '550');
    expect(model.dataSetIndex).toBe(0);
    expect(model.values().get('Dw')).toBe('500');
    editValue(model, 0, '575');
    expect(model.dataSetIndex).toBe(-1);
    expect(model.values().get('A')).toBe('575');
    expect(model.values().get('Dw')).toBe('500');
  });

  it('distinguishes D from d, accepts decimal commas and leaves optional blank cells unchanged', () => {
    const model = new ParameterPanelModel();
    model.setDefinitions([
      request({ name: 'D', variableName: 'D', defaultValue: '100' }),
      request({ name: 'd', variableName: 'd', defaultValue: '10' }),
      request({ name: 'Label', variableName: 'label', type: 'string' }),
    ]);
    expect(model.importTable('D\td\tLabel\tComment\n590\t11,5\t"Line 1\nLine 2"\tnote\n650\t\t"Fan ""B"""\t')).toBe(
      true,
    );
    expect(model.values().get('d')).toBe('11.5');
    expect(model.values().get('Label')).toBe('Line 1\nLine 2');
    expect(model.pasteMessage).toContain('Ignored: Comment');
    model.selectDataSet(1);
    expect(Object.fromEntries(model.values())).toEqual({ D: '650', d: '11.5', Label: 'Fan "B"' });
  });

  it('keeps the previous table and values if a paste has duplicate columns or malformed rows', () => {
    const model = new ParameterPanelModel();
    model.setDefinitions([request({ name: 'A', variableName: 'a' })]);
    expect(model.importTable('A\n10\n20')).toBe(true);
    const previousData = model.dataSets;
    for (const invalid of ['A\ta\n1\t2', 'A\n1\t2', 'Other\n1', 'A\n"unclosed']) {
      expect(model.importTable(invalid)).toBe(false);
      expect(model.pasteIsError).toBe(true);
      expect(model.dataSets).toBe(previousData);
      expect(model.values().get('A')).toBe('10');
    }
  });

  it('sends only edited values to the runtime, and Reset releases every override', () => {
    const model = new ParameterPanelModel();
    model.setDefinitions([request({ name: 'A' }), request({ name: 'B', variableName: 'b' })]);
    expect(model.overrides().size).toBe(0);
    editValue(model, 0, '40');
    expect(Object.fromEntries(model.overrides())).toEqual({ A: '40' });
    model.resetToSource();
    expect(model.overrides().size).toBe(0);
  });

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

describe('ParameterPanel reset to source', () => {
  it('restores current source defaults and lets later source changes apply again', () => {
    const model = new ParameterPanelModel();
    const changed = vi.fn();
    model.setChangedCallback(changed);
    model.setDefinitions([request({ defaultValue: '5' })]);
    editValue(model, 0, '12');
    model.setDefinitions([request({ defaultValue: '8' })]);
    expect(model.values().get('D')).toBe('12');
    model.edit(0, 3);
    model.editorTextEdited('99');
    model.resetToSource();
    expect(model.editor).toBeNull();
    expect(model.values().get('D')).toBe('8');
    expect(model.rows[0].texts[3]).toBe('8');
    expect(changed).toHaveBeenCalledTimes(2);
    model.setDefinitions([request({ defaultValue: '10' })]);
    expect(model.values().get('D')).toBe('10');
  });
});
