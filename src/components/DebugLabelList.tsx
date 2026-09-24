import { useRef } from 'react';
import type { DebugLabelPanel } from '../core/viewport/DebugLabelPanel';
import { useDebugLabelList } from '../hooks/useDebugLabelList';
import { cn } from '../utils/cn';

interface DebugLabelListProps {
  panel: DebugLabelPanel;
  onEnter: () => void;
  onFocus: () => void;
}

export function DebugLabelList({ panel, onEnter, onFocus }: DebugLabelListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const list = useDebugLabelList(panel, listRef);

  return (
    <div
      className={cn(
        'absolute z-2 cursor-default flex-col overflow-hidden rounded-lg shadow-lg ring-1 ring-viewport-label-header-line',
        list.visible ? 'flex' : 'hidden',
      )}
      data-panel={list.title}
      hidden={!list.visible}
      style={list.panelStyle}
      onPointerEnter={onEnter}
      onFocus={onFocus}
      onContextMenu={list.onContextMenu}
    >
      <div className="h-[25px] flex-none overflow-hidden border-b border-viewport-label-header-line bg-viewport-label-header px-2 leading-[24px] font-medium whitespace-pre text-viewport-label-header-fg">
        {list.headerText}
      </div>
      <div
        ref={listRef}
        className="relative min-h-0 flex-auto [scrollbar-width:thin] [scrollbar-color:var(--color-viewport-label-scrollbar)_var(--color-viewport-label-list)] overflow-x-hidden overflow-y-auto overscroll-contain bg-viewport-label-list outline-none focus-visible:ring-2 focus-visible:ring-viewport-button-line-focus focus-visible:ring-inset [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:bg-viewport-label-list [&::-webkit-scrollbar-thumb]:min-h-6 [&::-webkit-scrollbar-thumb]:rounded-[3px] [&::-webkit-scrollbar-thumb]:bg-viewport-label-scrollbar"
        role="listbox"
        aria-label={list.title}
        aria-multiselectable
        tabIndex={0}
        {...list.listHandlers}
      >
        <div className="relative" style={list.rowsStyle}>
          {list.rows.map((row) => (
            <div
              key={row.id}
              role="option"
              aria-selected={row.selected}
              className={cn(
                'absolute left-0 overflow-hidden',
                row.selected
                  ? 'bg-viewport-label-row-selected font-bold'
                  : 'bg-viewport-label-list hover:bg-viewport-label-row-hover',
              )}
              style={row.style}
            >
              <span
                className={cn(
                  'absolute left-[5.5px] size-[5px] rounded-full',
                  row.selected && 'bg-viewport-label-dot-selected',
                )}
                style={row.dotStyle}
              />
              <span
                className={cn(
                  'absolute top-0 h-full overflow-hidden text-left whitespace-pre',
                  row.selected ? 'text-viewport-label-selected-fg' : 'text-viewport-label-name',
                )}
                style={row.nameStyle}
              >
                {row.nameText}
              </span>
              <span
                className={cn(
                  'absolute top-0 h-full overflow-hidden text-right whitespace-pre',
                  row.selected ? 'text-viewport-label-selected-fg' : 'text-viewport-label-value',
                )}
                style={row.valueStyle}
              >
                {row.valueText}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
