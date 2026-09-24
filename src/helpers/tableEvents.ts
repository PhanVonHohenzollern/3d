interface TargetEvent {
  target: EventTarget | null;
}

const targetElement = (event: TargetEvent) => event.target as Element;

export function tableRowOf(event: TargetEvent): number {
  const row = targetElement(event).closest<HTMLElement>('tr[data-row]');
  return row ? Number(row.dataset.row) : -1;
}

export function tableCellOf(event: TargetEvent): { row: number; column: number } {
  const cell = targetElement(event).closest<HTMLElement>('td[data-column]');
  const row = cell?.closest<HTMLElement>('tr[data-row]');
  return row && cell ? { row: Number(row.dataset.row), column: Number(cell.dataset.column) } : { row: -1, column: -1 };
}

export const isInTableHeader = (event: TargetEvent): boolean => !!targetElement(event).closest('thead');

export const isInElement = (event: TargetEvent, selectors: string): boolean =>
  !!targetElement(event).closest(selectors);
