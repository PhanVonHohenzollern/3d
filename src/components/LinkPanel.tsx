import { Plus, Trash2 } from 'lucide-react';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useLinkPanel } from '../hooks/useLinkPanel';
import type { LinkPanelProps } from '../types/panels';
import { LinkForm } from './LinkForm';
import { LinkTable } from './LinkTable';
import { Splitter } from './Splitter';
import { PushButton } from './ui/PushButton';

export function LinkPanel(props: LinkPanelProps) {
  const compact = useCompactLayout();
  const { tableRef, nameRef, table, form, addConnector, removeConnector } = useLinkPanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none gap-2 border-b border-line px-4 py-2">
        <PushButton onClick={addConnector}>
          <Plus className="size-3.5" aria-hidden />
          Add connector
        </PushButton>
        <PushButton onClick={removeConnector}>
          <Trash2 className="size-3.5" aria-hidden />
          Remove
        </PushButton>
      </div>
      {compact ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="h-32 border-b border-line">
            <LinkTable tableRef={tableRef} {...table} />
          </div>
          <LinkForm nameRef={nameRef} {...form} />
        </div>
      ) : (
        <Splitter orientation="horizontal" initialSizes={[480, 520]} className="min-h-0 flex-1">
          <LinkTable tableRef={tableRef} {...table} />
          <LinkForm nameRef={nameRef} {...form} />
        </Splitter>
      )}
    </div>
  );
}
