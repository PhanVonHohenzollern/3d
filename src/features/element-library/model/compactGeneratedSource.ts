/**
 * Compacts C++ snippets extracted from preprocessed library sources.
 * Preprocessing deliberately preserves source line numbers by leaving blank lines
 * behind. That is useful for diagnostics against the original files, but the
 * generated editor tabs use their own line numbers and must not inherit gaps.
 * Preserve raw-string contents verbatim, including intentional blank lines.
 */
export function compactGeneratedSource(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let rawTerminator: string | null = null;
  let blankLines = 0;

  for (const line of lines) {
    let offset = 0;
    let insideRaw = rawTerminator !== null;
    while (offset < line.length) {
      if (rawTerminator !== null) {
        const end = line.indexOf(rawTerminator, offset);
        if (end < 0) break;
        offset = end + rawTerminator.length;
        rawTerminator = null;
        continue;
      }
      const opening = /(?:u8|u|U|L)?R"([^()\\\s]{0,16})\(/g;
      opening.lastIndex = offset;
      const match = opening.exec(line);
      if (!match) break;
      offset = match.index + match[0].length;
      rawTerminator = `)${match[1]}"`;
      insideRaw = true;
    }
    if (!line.trim() && rawTerminator === null && !insideRaw) {
      if (output.length && blankLines === 0) output.push("");
      ++blankLines;
    } else {
      output.push(line);
      blankLines = 0;
    }
  }
  while (output.at(-1) === "") output.pop();

  return output.join("\n").trim() + "\n";
}
