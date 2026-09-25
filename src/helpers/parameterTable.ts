import { parameterKey, type RuntimeParameterRequest } from '../core/runtime/RuntimeTypes';

// Excel's text clipboard uses tabs, CRLF, and CSV-style quotes for multiline cells.
export function parameterTableCells(text: string): string[][] {
  if (text.length > 1_000_000) throw new Error('Paste a table smaller than 1 MB.');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"' && (quoted || cell === '')) {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === '\t' || c === '\n')) {
      row.push(cell.trim());
      cell = '';
      if (c === '\n') {
        rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw new Error('The pasted table has an unclosed quoted cell.');
  row.push(cell.trim());
  rows.push(row);

  return rows.filter((r) => r.some((value) => value !== ''));
}

export function parameterTableText(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) => row.map((value) => (/[\t\r\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)).join('\t'))
    .join('\n');
}

export function parseParameterTable(text: string, definitions: readonly RuntimeParameterRequest[]) {
  const [headers, ...rows] = parameterTableCells(text);
  if (!headers || !rows.length) throw new Error('Copy the header names and at least one data row from Excel.');
  const keys = [...new Set(definitions.map((d) => d.name))];
  const used = new Set<string>();
  const ignored: string[] = [];
  const columns = headers.map((header) => {
    let matches = keys.filter((key) => key === header);
    if (!matches.length)
      matches = [...new Set(definitions.filter((d) => d.variableName === header).map((d) => d.name))];
    if (!matches.length) matches = keys.filter((key) => key.toLowerCase() === header.toLowerCase());
    if (matches.length > 1)
      throw new Error(`Ambiguous column "${header}". Use the exact get_val key, including letter case.`);
    const key = matches[0];
    if (!key) {
      if (header) ignored.push(header);

      return null;
    }
    if (used.has(key)) throw new Error(`More than one column matches "${key}".`);
    used.add(key);

    return key;
  });
  if (!used.size) throw new Error('No matching parameters. The first row must contain get_val keys or variable names.');
  const data = rows
    .map((row, index) => {
      if (row.slice(headers.length).some(Boolean)) throw new Error(`Row ${index + 2} has more values than the header.`);
      const values = new Map<string, string>();
      columns.forEach((key, column) => {
        if (!key) return;
        let value = row[column] ?? '';
        // Empty optional cells leave the existing parameter untouched.
        if (value === '') return;
        const type = definitions.find((d) => d.name === key)?.type;
        if (type !== 'string' && /^[+-]?\d+,\d+(?:e[+-]?\d+)?$/i.test(value)) value = value.replace(',', '.');
        const definition = definitions.find((d) => d.name === key)!;
        values.set(parameterKey(definition), value);
      });

      return values;
    })
    .filter((row) => row.size > 0);
  if (!data.length) throw new Error('No values found for the matching parameters.');

  return { data, ignored, columns: used.size };
}
