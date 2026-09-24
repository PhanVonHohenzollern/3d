// Port of the widget part of ui/LinkPanel: Add/Remove buttons, and a
// splitter with the connector table (Connector | Point | Type | Position |
// Preview) and the connector form. State and slots live in LinkPanelModel
// (LinkModel.ts); the ref handle is that model.

import {
  useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type MouseEvent, type Ref,
} from 'react';
import type { ConnectorExpressionEvaluator } from '../geometry/ConnectorPreview';
import { Splitter } from '../app/Splitter';
import {
  kConnectorTypes, kOrientationLabels, LinkPanelModel, type LinkPanelHandle, type PreviewChangedCallback, type SizeField,
} from './LinkModel';
import { useObservable } from './Observable';
import './ItemViews.css';
import './LinkPanel.css';

export type { LinkPanelHandle } from './LinkModel';

export interface LinkPanelProps {
  /** setExpressionEvaluator */
  expressionEvaluator?: ConnectorExpressionEvaluator;
  /** setPreviewChangedCallback */
  onPreviewChanged?: PreviewChangedCallback;
  ref?: Ref<LinkPanelHandle>;
}

/**
 * Editable QComboBox (NoInsert): a line edit with a drop-down list of the
 * executed get_val variables. Every text change is currentTextChanged.
 */
function SizeComboBox({ value, items, disabled, onTextChanged }: {
  value: string; items: readonly string[]; disabled: boolean; onTextChanged: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [popupRect, setPopupRect] = useState({ left: 0, top: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  // The popup is a separate top-level window in Qt: never clipped by the scroll area.
  const openPopup = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setPopupRect({ left: rect.left, top: rect.bottom + 1, width: rect.width });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close, true);
    return () => window.removeEventListener('mousedown', close, true);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length && !event.altKey) {
      event.preventDefault();
      const index = items.indexOf(value);
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0);
      if (items[next] !== undefined && items[next] !== value) onTextChanged(items[next]);
    } else if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      openPopup();
    }
  };

  return (
    <div ref={rootRef} className={`combo-box editable${disabled ? ' disabled' : ''}`}>
      <input
        className="line-edit"
        value={value}
        disabled={disabled}
        spellCheck={false}
        placeholder="get_val variable / expression"
        onChange={(e) => onTextChanged(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="combo-arrow" disabled={disabled} tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : openPopup())} />
      {open && !disabled && (
        <ul className="combo-popup" style={popupRect}>
          {items.map((item) => (
            <li key={item} className={item === value ? 'current' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setOpen(false); onTextChanged(item); }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const kTableHeaders = ['Connector', 'Point', 'Type', 'Position', 'Preview'];
const kAngleLabels = ['a / X (deg)', 'b / Y (deg)', '\u03b3 / Z (deg)'];
const kAxisLabels = ['X', 'Y', 'Z'];

export function LinkPanel({ expressionEvaluator, onPreviewChanged, ref }: LinkPanelProps) {
  const [model] = useState(() => new LinkPanelModel());
  useObservable(model);
  const tableRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    model.setExpressionEvaluator(expressionEvaluator ?? null);
    model.setPreviewChangedCallback(onPreviewChanged ?? null);
  }, [model, expressionEvaluator, onPreviewChanged]);
  useImperativeHandle(ref, () => model, [model]);

  // m_name->setFocus(); m_name->selectAll();
  const focusNameSerial = model.focusNameSerial;
  useLayoutEffect(() => {
    if (!focusNameSerial) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [focusNameSerial]);

  const scrollSerial = model.scrollRequest?.serial;
  useLayoutEffect(() => {
    const request = model.scrollRequest;
    if (!request) return;
    tableRef.current?.querySelector(`tr[data-row="${request.row}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [model, scrollSerial]);

  const onTableMouseDown = (event: MouseEvent) => {
    const target = event.target as Element;
    if (event.button !== 0 || target.closest('thead') || target.closest('button')) return;
    event.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    const cell = target.closest<HTMLElement>('td[data-column]');
    const row = cell?.closest<HTMLElement>('tr[data-row]');
    if (row && cell) model.cellActivated(Number(row.dataset.row), Number(cell.dataset.column));
  };
  const onTableKeyDown = (event: KeyboardEvent) => {
    if (event.target !== tableRef.current || event.altKey || event.ctrlKey || event.metaKey) return;
    if (model.tableKeyPress(event.key)) event.preventDefault();
  };

  const disabled = !model.formEnabled;
  const sizeCombo = (field: SizeField) => (
    <SizeComboBox value={model.sizeTexts[field]} items={model.parameterNames} disabled={disabled}
      onTextChanged={(text) => model.sizeTextChanged(field, text)} />
  );

  return (
    <div className="link-panel">
      <div className="link-buttons">
        <button type="button" className="push-button" onClick={() => model.addConnector()}>Add connector</button>
        <button type="button" className="push-button" onClick={() => model.removeConnector()}>Remove</button>
      </div>
      <Splitter orientation="horizontal" initialSizes={[480, 520]} className="link-splitter">
        <div ref={tableRef} className="table-view link-table" tabIndex={0} onMouseDown={onTableMouseDown} onKeyDown={onTableKeyDown}>
          <table className="item-table">
            <thead>
              <tr className="item-header">
                {kTableHeaders.map((header, column) => (
                  <th key={header} className={column === 3 ? 'stretch' : 'fit'}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.tableRows.map((row, index) => (
                <tr key={row.id} data-row={index} className={index === model.currentRow ? 'selected' : undefined}>
                  {row.texts.map((text, column) => (
                    <td key={column} data-column={column}
                      className={index === model.currentRow && column === model.currentColumn ? 'current-cell' : undefined}>
                      {text}
                    </td>
                  ))}
                  <td data-column={4} className="cell-widget">
                    <button type="button" className="tool-button link-preview-button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => model.togglePreview(row.id)}>{row.buttonText}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="link-form-scroll">
          <fieldset className="link-form" disabled={disabled}>
            <label>Identifier</label>
            <input ref={nameRef} className="line-edit" value={model.nameText} spellCheck={false}
              onChange={(e) => model.nameEdited(e.target.value)} />
            <label>Point</label>
            <input className="line-edit" value={model.pointText} spellCheck={false}
              onChange={(e) => model.pointEdited(e.target.value)}
              onBlur={() => model.pointEditingFinished(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') model.pointEditingFinished(true); }} />

            <label>Type</label>
            <select className="combo-box span-3" value={model.typeIndex}
              onChange={(e) => model.typeChanged(Number(e.target.value))}>
              {kConnectorTypes.map((type, index) => <option key={type} value={index}>{type}</option>)}
            </select>

            {model.circularFields ? (
              <>
                <label>Diameter</label>
                <div className="span-3">{sizeCombo('diameter')}</div>
              </>
            ) : (
              <>
                <label>A</label>
                {sizeCombo('aSize')}
                <label>B</label>
                {sizeCombo('bSize')}
              </>
            )}

            <label>Orientation</label>
            <div className="span-3 link-orientation">
              {kOrientationLabels.map((label, id) => (
                <button key={label} type="button"
                  className={`push-button orientation-button${model.orientationId === id ? ' checked' : ''}`}
                  aria-pressed={model.orientationId === id}
                  onClick={() => model.orientationClicked(id)}>{label}</button>
              ))}
            </div>

            {[0, 1, 2].map((i) => (
              <div key={i} className="link-form-row">
                <label>{kAxisLabels[i]}</label>
                <input className="line-edit" value={model.positionTexts[i]} spellCheck={false}
                  onChange={(e) => model.positionEdited(i, e.target.value)} />
                <label>{kAngleLabels[i]}</label>
                <input className="line-edit" value={model.angleTexts[i]} spellCheck={false}
                  onChange={(e) => model.angleEdited(i, e.target.value)} />
              </div>
            ))}

            <div className="span-4">
              <button type="button" className="push-button link-test-button" onClick={() => model.testSelection()}>
                Test selected point
              </button>
            </div>
            <div className={`span-4 link-status${model.statusIsError ? ' error' : ''}`}>{model.statusText}</div>
          </fieldset>
        </div>
      </Splitter>
    </div>
  );
}
