import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationControlsProps } from '../types/pagination';
import { Button } from './ui/button';

export function PaginationControls({ page, pageCount, total, start, end, onPageChange }: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-line px-2 text-[10px] text-muted-foreground">
      <span className="truncate tabular-nums">{total ? `${start + 1}–${end} of ${total}` : '0 items'}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-0.5 px-1 text-[10px]"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3" /> Previous
        </Button>
        <span className="tabular-nums">
          Page {page + 1} of {pageCount}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-0.5 px-1 text-[10px]"
          aria-label="Next page"
          disabled={page + 1 === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
