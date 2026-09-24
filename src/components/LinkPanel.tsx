import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useLinkPanel } from '../hooks/useLinkPanel';
import type { LinkPanelProps } from '../types/panels';
import { LinkForm } from './LinkForm';
import { LinkTable } from './LinkTable';
import { Button } from './ui/button';

export function LinkPanel(props: LinkPanelProps) {
  const {
    tableRef,
    nameRef,
    table,
    form,
    isEditing,
    hasConnectors,
    canEdit,
    selectedName,
    showList,
    addConnector,
    removeConnector,
  } = useLinkPanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {isEditing ? (
        <div className="shrink-0 border-b border-line">
          <div className="flex h-7 items-center gap-2 px-1">
            <Button variant="ghost" className="h-6 px-1 text-[11px]" onClick={showList}>
              <ArrowLeft className="size-3" />
              Connectors
            </Button>
            <span className="min-w-0 flex-1 truncate text-xs font-medium" title={selectedName}>
              {selectedName}
            </span>
            <Button
              variant="ghost"
              className="size-6"
              aria-label="Remove selected connector"
              onClick={removeConnector}
              disabled={!canEdit}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      ) : hasConnectors ? (
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-1.5">
          <span className="mr-auto truncate text-[11px] text-muted-foreground">Double-click a connector to edit</span>
          <Button className="h-6 px-2 text-[11px]" onClick={addConnector}>
            <Plus className="size-3" />
            New
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-2 text-center text-xs">
          <p className="font-medium">Create your first connector</p>
          <p className="text-muted-foreground">Name it, set its size, then Make to preview it.</p>
          <Button className="h-7 px-3 text-xs" onClick={addConnector}>
            <Plus className="size-3" />
            New connector
          </Button>
        </div>
      )}
      <div className={!isEditing && hasConnectors ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <LinkTable tableRef={tableRef} {...table} />
      </div>
      <div className={isEditing ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <LinkForm nameRef={nameRef} {...form} />
      </div>
    </div>
  );
}
