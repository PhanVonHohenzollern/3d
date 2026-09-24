export function containerPageSize(
  width: number,
  height: number,
  rowHeight: number,
  headerHeight = 0,
  minimumColumnWidth = 0,
) {
  const columns = minimumColumnWidth ? Math.max(1, Math.floor(width / minimumColumnWidth)) : 1;
  const rows = Math.max(1, Math.floor((height - 28 - headerHeight) / rowHeight));

  return { columns, pageSize: rows * columns };
}
