import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationControlsProps } from '../types/pagination';
import { Button } from './ui/button';

export function PaginationControls({ page, pageCount, total, start, end, onPageChange }: PaginationControlsProps) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-line px-2 text-[10px] text-muted-foreground">
      <span className="truncate tabular-nums">{total ? `${start + 1}–${end} of ${total}` : '0 items'}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3" />
        </Button>
        <span className="tabular-nums">
          {page + 1} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Next page"
          disabled={page + 1 === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
