import { useLinkPanel } from '../hooks/useLinkPanel';
import type { LinkPanelProps } from '../types/panels';
import { LinkForm } from './LinkForm';
import { LinkTable } from './LinkTable';
import { Splitter } from './Splitter';
import { PushButton } from './ui/PushButton';

export function LinkPanel(props: LinkPanelProps) {
  const { tableRef, nameRef, table, form, addConnector, removeConnector } = useLinkPanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 p-1">
      <div className="flex flex-none gap-1.5">
        <PushButton onClick={addConnector}>Add connector</PushButton>
        <PushButton onClick={removeConnector}>Remove</PushButton>
      </div>
      <Splitter orientation="horizontal" initialSizes={[480, 520]} className="min-h-0 flex-1">
        <LinkTable tableRef={tableRef} {...table} />
        <LinkForm nameRef={nameRef} {...form} />
      </Splitter>
    </div>
  );
}
