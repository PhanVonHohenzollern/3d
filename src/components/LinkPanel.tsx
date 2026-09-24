import { Plus, Trash2 } from 'lucide-react';
import { useLinkPanel } from '../hooks/useLinkPanel';
import type { LinkPanelProps } from '../types/panels';
import { LinkForm } from './LinkForm';
import { LinkTable } from './LinkTable';
import { ComboBox } from './ui/ComboBox';
import { PushButton } from './ui/PushButton';

export function LinkPanel(props: LinkPanelProps) {
  const { tableRef, nameRef, table, form, section, setSection, addConnector, removeConnector } = useLinkPanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none gap-1.5 border-b border-line px-1.5 py-1">
        <PushButton title="Add connector" sizeClassName="h-7 px-2" onClick={addConnector}>
          <Plus className="size-3.5" aria-hidden />
          Add
        </PushButton>
        <PushButton sizeClassName="h-7 px-2" onClick={removeConnector}>
          <Trash2 className="size-3.5" aria-hidden />
          Remove
        </PushButton>
        <ComboBox
          aria-label="Connector section"
          className="ml-auto h-7 w-auto min-w-0 text-xs [&_select[data-size=sm]]:h-7"
          value={section}
          onChange={(event) => setSection(event.target.value)}
        >
          {['Connectors', 'Identity', 'Dimensions', 'Position', 'Rotation'].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </ComboBox>
      </div>
      <div className={section === 'Connectors' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <LinkTable tableRef={tableRef} {...table} />
      </div>
      <div className={section !== 'Connectors' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <LinkForm nameRef={nameRef} section={section} {...form} />
      </div>
    </div>
  );
}
