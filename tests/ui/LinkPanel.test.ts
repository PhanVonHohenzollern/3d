import { describe, expect, it } from 'vitest';
import type { ConnectorPreview } from '../../src/core/geometry/ConnectorPreview';
import type { RuntimeParameterRequest } from '../../src/core/runtime/RuntimeTypes';
import { emptyRuntimeResult } from '../../src/core/runtime/RuntimeTypes';
import { LinkPanelModel } from '../../src/hooks/linkPanel/LinkPanelModel';

const evaluate = (expression: string) => {
  const value = Number(expression);
  if (expression.trim() === '' || !Number.isFinite(value)) throw new Error(`Unknown value: ${expression}`);

  return value;
};

function createPanel() {
  const model = new LinkPanelModel();
  const published: { previews: readonly ConnectorPreview[]; selectedId: number; tested: boolean }[] = [];
  model.setExpressionEvaluator(evaluate);
  model.setPreviewChangedCallback((previews, selectedId, tested) => published.push({ previews, selectedId, tested }));

  return { model, published };
}

function getVal(name: string, variableName: string, type = 'double'): RuntimeParameterRequest {
  return { name, type, defaultValue: '', currentValue: '', sourceFunction: 'get_val', variableName, line: 1 };
}

describe('LinkPanel', () => {
  it('adds connectors with unique names and point names, selecting the new row', () => {
    const { model, published } = createPanel();
    expect(model.formEnabled).toBe(false);
    model.addConnector();
    expect(model.tableRows[0].texts).toEqual(['Connector 1', 'linkPoint1', 'Circular', '(0, 0, 0)']);
    expect(model.tableRows[0].buttonText).toBe('Show');
    expect([model.currentRow, model.currentColumn]).toEqual([0, 1]);
    expect(model.formEnabled).toBe(true);
    expect(model.nameText).toBe('Connector 1');
    expect(model.focusNameSerial).toBe(1);
    expect(published.at(-1)).toEqual({ previews: [], selectedId: 1, tested: false });

    model.pointEdited('linkPoint2');
    model.pointEditingFinished(true);
    model.addConnector();
    expect(model.definitions().map((d) => d.pointName)).toEqual(['linkPoint2', 'linkPoint3']);
  });

  it('validates point renames: nonempty and unique within Link', () => {
    const { model } = createPanel();
    model.addConnector();
    model.addConnector();
    model.pointEdited('   ');
    model.pointEditingFinished(false);
    expect(model.statusText).toBe('Point name cannot be empty');
    expect(model.statusIsError).toBe(true);
    expect(model.pointText).toBe('linkPoint2');

    model.pointEdited('linkPoint1');
    model.pointEditingFinished(true);
    expect(model.statusText).toBe('Point name is already used');
    expect(model.definitions()[1].pointName).toBe('linkPoint2');

    model.pointEdited(' pA ');
    model.pointEditingFinished(false);
    expect(model.statusText).toBe('');
    expect(model.definitions()[1].pointName).toBe('pA');
    expect(model.tableRows[1].texts[1]).toBe('pA');

    model.pointText = 'unsaved';
    model.pointEditingFinished(false);
    expect(model.definitions()[1].pointName).toBe('pA');
  });

  it('tests the selected point, keeps it on rename and invalidates it on geometry edits', () => {
    const { model, published } = createPanel();
    model.addConnector();
    model.testSelection();
    expect(model.statusIsError).toBe(true);
    expect(published.at(-1)?.tested).toBe(false);

    model.sizeTextChanged('diameter', ' 10 ');
    expect(model.definitions()[0].diameter).toBe('10');
    model.testSelection();
    expect(model.statusIsError).toBe(false);
    expect(model.statusText).toMatch(/^linkPoint1 = \(0, 0, 0\)\nDirection = \(.+\); test length = 3\.5$/);
    expect(model.tableRows[0].buttonText).toBe('Hide');
    expect(published.at(-1)).toMatchObject({ selectedId: 1, tested: true });
    expect(published.at(-1)?.previews).toHaveLength(1);

    model.nameEdited('Inlet');
    expect(published.at(-1)?.previews[0].name).toBe('Inlet');
    expect(model.tableRows[0].buttonText).toBe('Hide');

    model.orientationClicked(3);
    expect(model.tableRows[0].buttonText).toBe('Show');
    expect(published.at(-1)?.previews).toHaveLength(0);
  });

  it('Show/Hide toggles per row and Esc (exitPreview) hides every connector but keeps them', () => {
    const { model, published } = createPanel();
    model.addConnector();
    model.sizeTextChanged('diameter', '4');
    model.addConnector();
    model.sizeTextChanged('diameter', '6');
    model.togglePreview(1);
    model.togglePreview(2);
    expect(published.at(-1)?.previews.map((p) => p.id)).toEqual([1, 2]);
    model.togglePreview(1);
    expect(published.at(-1)?.previews.map((p) => p.id)).toEqual([2]);
    expect(model.currentRow).toBe(0);
    model.exitPreview();
    expect(published.at(-1)?.previews).toEqual([]);
    expect(model.tableRows.map((row) => row.buttonText)).toEqual(['Show', 'Show']);
    expect(model.definitions()).toHaveLength(2);
  });

  it('suggests executed numeric get_val variables and refreshes cached tests', () => {
    const { model } = createPanel();
    model.updateRuntimeResult({
      ...emptyRuntimeResult(),
      parameterRequests: [
        getVal('D', 'diameter'),
        getVal('D2', ''),
        getVal('N', 'name', 'string'),
        getVal('D', 'diameter'),
      ],
    });
    expect(model.parameterNames).toEqual(['diameter', 'D2']);

    model.addConnector();
    model.sizeTextChanged('diameter', '8');
    model.testSelection();
    model.setExpressionEvaluator(() => {
      throw new Error('Unknown value: diameter');
    });
    model.updateRuntimeResult(emptyRuntimeResult());
    expect(model.tableRows[0].buttonText).toBe('Show');
    expect(model.statusText).toBe('Diameter: Unknown value: diameter');
  });

  it('removes the current connector and selects the next row', () => {
    const { model } = createPanel();
    model.addConnector();
    model.addConnector();
    model.addConnector();
    model.cellActivated(1, 0);
    model.removeConnector();
    expect(model.definitions().map((d) => d.id)).toEqual([1, 3]);
    expect([model.currentRow, model.nameText]).toEqual([1, 'Connector 3']);
    model.removeConnector();
    model.removeConnector();
    expect(model.formEnabled).toBe(false);
    expect(model.currentRow).toBe(-1);
  });
});
