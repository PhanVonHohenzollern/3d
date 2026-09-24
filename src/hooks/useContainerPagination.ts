import { useLayoutEffect, useRef, useState } from 'react';
import { containerPageSize } from '../helpers/pagination';
import type { ContainerPagination, PaginationOptions } from '../types/pagination';

export function useContainerPagination<T>(items: readonly T[], options: PaginationOptions): ContainerPagination<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { columns, pageSize } = containerPageSize(
    size.width,
    size.height,
    options.rowHeight,
    options.headerHeight,
    options.minimumColumnWidth,
  );
  const [navigation, setNavigation] = useState({ anchor: 0, selectionKey: options.selectionKey });
  if (navigation.selectionKey !== options.selectionKey) {
    setNavigation({
      anchor: Math.max(0, options.selectedIndex ?? 0),
      selectionKey: options.selectionKey,
    });
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.floor(navigation.anchor / pageSize), pageCount - 1);
  const start = page * pageSize;
  const end = Math.min(items.length, start + pageSize);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      if (element.clientWidth && element.clientHeight)
        setSize({ width: element.clientWidth, height: element.clientHeight });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const onPageChange = (next: number) =>
    setNavigation({
      anchor: Math.max(0, Math.min(next, pageCount - 1)) * pageSize,
      selectionKey: options.selectionKey,
    });

  return {
    containerRef,
    columns,
    items: items.slice(start, end),
    controls: { page, pageCount, total: items.length, start, end, onPageChange },
  };
}
