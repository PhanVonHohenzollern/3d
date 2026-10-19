import type {
  FlmTechnology,
  ParsedLibraryJSON,
} from "@/features/element-library/model/parsedLibrary";

/** Resolve only definitions owned by this JSON library. Never search another catalog. */
export function resolveLocalTechnology(
  library: ParsedLibraryJSON,
  token: string | undefined,
): { id?: string; technology?: FlmTechnology; issue?: string } {
  const name = token?.trim();
  if (!name) return {};
  const technologies = library.technologies ?? {};

  // Technical identifiers are authoritative and take precedence over labels.
  const direct = technologies[name];
  if (direct) return { id: direct.id, technology: direct };
  const byGuid = Object.values(technologies).filter(
    (technology) => technology.guid?.toLowerCase() === name.toLowerCase(),
  );
  if (byGuid.length === 1) return { id: byGuid[0].id, technology: byGuid[0] };
  if (byGuid.length > 1)
    return { issue: `ambiguous local technology GUID ${name}` };

  // DEF_TECHID may use a local display alias. Such an alias is usable only
  // when exactly one technology in THIS library owns it.
  const aliases = Object.values(technologies).filter(
    (technology) =>
      technology.names?.TECH_NAME?.EN?.trim().toLowerCase() ===
        name.toLowerCase() ||
      technology.id.toLowerCase() === name.toLowerCase(),
  );
  if (aliases.length === 1)
    return { id: aliases[0].id, technology: aliases[0] };
  if (aliases.length > 1)
    return { issue: `ambiguous local technology ${name}` };

  return { issue: `missing local technology ${name}` };
}
