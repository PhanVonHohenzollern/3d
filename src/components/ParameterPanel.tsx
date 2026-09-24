import { useParameterPanel } from '../hooks/useParameterPanel';
import type { ParameterPanelProps } from '../types/panels';
import { Cell, HeaderCell, TableView } from './ui/TableView';

export function ParameterPanel(props: ParameterPanelProps) {
  const {
    tableRef,
    editorRef,
    headers,
    valueColumn,
    rows,
    selectedRow,
    currentRow,
    currentColumn,
    editor,
    onMouseDown,
    onMouseUp,
    onKeyDown,
    onEditorChange,
    onEditorKeyDown,
    onEditorBlur,
  } = useParameterPanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableView
        emptyMessage={
          rows.length === 0 ? 'Add a get_val() call in your code to expose an editable parameter.' : undefined
        }
        ref={tableRef}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {headers.map((header, column) => (
              <HeaderCell key={header} stretch={column === valueColumn}>
                {header}
              </HeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} data-row={index}>
              {row.texts.map((text, column) => (
                <Cell
                  key={column}
                  column={column}
                  selected={index === selectedRow}
                  current={index === currentRow && column === currentColumn}
                  padding={editor?.row === index && column === valueColumn ? 'none' : 'text'}
                >
                  {editor?.row === index && column === valueColumn ? (
                    <input
                      ref={editorRef}
                      data-serial={editor.serial}
                      className="h-8 w-full rounded-sm border border-line-hover bg-base px-3 text-fg outline-none"
                      value={editor.text}
                      spellCheck={false}
                      onChange={onEditorChange}
                      onKeyDown={onEditorKeyDown}
                      onBlur={onEditorBlur}
                    />
                  ) : (
                    text
                  )}
                </Cell>
              ))}
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}
