import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
// Build-time modules run in Node, before Vite resolves application aliases.
// eslint-disable-next-line no-restricted-imports
import { geometryRegistry } from './geometryRegistry.ts';
export { geometryRegistry };
// The same JSON decoder is used at build time and in the browser.
// eslint-disable-next-line no-restricted-imports
import { readParsedLibrary } from '../src/features/element-library/model/parsedLibrary.ts';

export interface LibraryDescriptor {
  name: string;
  error?: string;
  catalog: {
    label: string;
    categories: { id: string; name: string; elements: string[] }[];
    items: Record<string, { symbol: string; thumbnail: string; listed?: boolean; sourceGroup?: string }>;
  };
  sources: { name: string; path: string }[];
  entries: Record<string, { entry: string; error?: string }>;
}

function sourceText(bytes: Uint8Array): string {
  return new TextDecoder(
    bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8',
  ).decode(bytes);
}

export function discoverLibraries(root: string) {
  const folder = join(root, 'libraries');
  if (!existsSync(folder)) return [];
  const thumbnailsPath = join(root, 'src/features/element-library/config/thumbnails.json');
  const thumbnails = existsSync(thumbnailsPath) ? JSON.parse(readFileSync(thumbnailsPath, 'utf8')) : {};

  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((directory) => {
      const name = directory.name;
      const path = join(folder, name);
      const files = readdirSync(path).sort();
      const localFiles = readdirSync(path, { recursive: true, withFileTypes: true })
        .filter((file) => file.isFile())
        .map((file) => ({
          file: join(file.parentPath, file.name),
          name: relative(path, join(file.parentPath, file.name)).split(sep).join('/'),
        }));
      const svgFiles = localFiles
        .filter((file) => /\.svg$/i.test(file.name))
        .map((file) => ({ ...file, basename: file.name.split('/').at(-1)! }));
      const icons = new Map<string, { file: string; path: string }>();
      const json = files.filter((file) => /\.json$/i.test(file));
      if (!json.length) return []; // An incomplete copy is not yet a library.
      const preferred = json.filter((file) =>
        [name.toLowerCase() + '.json', 'library.json'].includes(file.toLowerCase()),
      );
      const selected = json.length === 1 ? json[0] : preferred.length === 1 ? preferred[0] : undefined;
      const jsonPath = join(path, selected ?? json[0]);

      const unavailable = (message: string) => ({
        descriptor: {
          name,
          error: `${name}: ${message}`,
          catalog: { label: name, categories: [], items: {} },
          sources: [],
          entries: {},
        } as LibraryDescriptor,
        jsonPath,
        sourceFiles: [] as { file: string; name: string }[],
        icons: [] as { file: string; path: string }[],
        emitted: false,
      });

      // A broken/incomplete new library must not prevent existing independent
      // libraries from building or appearing in the catalog.
      if (!selected) return [unavailable('ambiguous library JSON: use <FolderName>.json or library.json')];
      let parsed: ReturnType<typeof readParsedLibrary>;
      try {
        parsed = readParsedLibrary(JSON.parse(readFileSync(jsonPath, 'utf8')));
      } catch (error) {
        return [unavailable(`cannot read ${selected}: ${error instanceof Error ? error.message : String(error)}`)];
      }
      const codePath = localFiles.some((file) => /\.(h|cpp)$/i.test(file.name))
        ? path
        : join(root, 'public/demo/code', name);
      const sourceFiles = (
        existsSync(codePath)
          ? readdirSync(codePath, { recursive: true, withFileTypes: true })
              .filter((file) => file.isFile() && /\.(h|cpp)$/i.test(file.name))
              .map((file) => ({
                file: join(file.parentPath, file.name),
                name: relative(codePath, join(file.parentPath, file.name)).split(sep).join('/'),
              }))
          : []
      ).sort((a, b) => a.name.localeCompare(b.name));
      const missingSources =
        !sourceFiles.some(({ name }) => /\.cpp$/i.test(name)) || !sourceFiles.some(({ name }) => /\.h$/i.test(name));
      const registry = new Map<string, string>();
      const registryProblems: string[] = [];
      for (const source of sourceFiles) {
        try {
          for (const [block, entry] of geometryRegistry(sourceText(readFileSync(source.file)))) {
            if (registry.has(block) && registry.get(block) !== entry) throw new Error(`ambiguous geometry ${block}`);
            registry.set(block, entry);
          }
        } catch (error) {
          registryProblems.push(`${source.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const entries: LibraryDescriptor['entries'] = {};
      const items: LibraryDescriptor['catalog']['items'] = {};
      for (const entity of Object.values(parsed.entities)) {
        const block = entity.geometry?.children.find((node) => node.tag === 'FNBLKNAME')?.text ?? '';
        const entry = registry.get(block);
        const error = missingSources
          ? `${entity.id}: missing geometry .h/.cpp in this library`
          : !entry
            ? `${entity.id}: no registered geometry for ${block || '(no geometry definition)'}${
                registryProblems.length ? ` (${registryProblems.join('; ')})` : ''
              }`
            : undefined;
        entries[entity.guid] = { entry: error ? '' : (entry ?? ''), ...(error ? { error } : {}) };
        const slide = entity.paths
          ?.find((p) => p.NAME === 'ENT_SMALLSLIDE')
          ?.value?.replace(/^.*[/\\]/, '')
          .replace(/\.(sld|slb|svg)$/i, '')
          .toLowerCase();
        const matches = slide ? svgFiles.filter((file) => file.basename.toLowerCase() === slide + '.svg') : [];
        // A duplicated optional thumbnail must not make geometry unavailable.
        const localIcon = matches.length === 1 ? matches[0] : undefined;
        if (localIcon)
          icons.set(localIcon.name, { file: localIcon.file, path: `library-icons/${name}/${localIcon.name}` });
        const existingIcon = thumbnails[name]?.[entity.guid];
        const thumbnail = localIcon
          ? localIcon.name
          : existingIcon && existsSync(join(root, 'public/library-icons', name, existingIcon))
            ? existingIcon
            : slide && existsSync(join(root, 'public/library-icons', name, slide + '.svg'))
              ? slide + '.svg'
              : '';
        items[entity.guid] = {
          symbol: entity.names?.ENT_SYMBOL?.EN || entity.id,
          thumbnail,
          sourceGroup: entity.legacyIds?.map((legacy) => legacy.GRPID?.trim()).filter(Boolean).join(', '),
        };
      }
      const folders = new Map(parsed.folders.map((f) => [f.guid, f]));

      const collect = (id: string, ancestors = new Set<string>()): string[] => {
        if (ancestors.has(id)) throw new Error(`${name}: folder cycle at ${id}`);
        const next = new Set([...ancestors, id]);

        return [
          ...new Set(
            (folders.get(id)?.entries ?? []).flatMap((e) => (items[e.guid] ? [e.guid] : collect(e.guid, next))),
          ),
        ];
      };

      let categories: LibraryDescriptor['catalog']['categories'];
      try {
        categories = parsed.folders.map((f) => ({
          id: f.guid,
          name: f.names.NAME?.EN || f.guid,
          elements: collect(f.guid),
        }));
      } catch (error) {
        // A malformed folder graph belongs to this library only: isolate it
        // instead of preventing other independent libraries from loading.
        return [
          unavailable(`cannot resolve library folders: ${error instanceof Error ? error.message : String(error)}`),
        ];
      }
      // FOLDER_ENTRY GUIDs define the catalog. Legacy group names must not
      // place unlisted duplicate symbols into current folders.
      const listed = new Set(categories.flatMap((category) => category.elements));
      for (const [id, item] of Object.entries(items)) item.listed = listed.has(id);
      categories.sort((a, b) => a.name.localeCompare(b.name, 'en'));
      const sources = sourceFiles.map(({ file, name: fileName }) => ({
        name: fileName,
        path:
          codePath === path
            ? `demo/libraries/${name}/${fileName}`
            : relative(join(root, 'public'), file).split(sep).join('/'),
      }));
      const descriptor: LibraryDescriptor = {
        name,
        catalog: { label: parsed.library.producer?.name || name, categories, items },
        sources,
        entries,
      };

      return [{ descriptor, jsonPath, sourceFiles, icons: [...icons.values()], emitted: codePath === path }];
    });
}

export function flmLibraries(root = process.cwd()): Plugin {
  let libraries: ReturnType<typeof discoverLibraries> = [];
  let server: ViteDevServer | undefined;
  const manifest = 'virtual:flm-libraries';
  const prefix = 'virtual:flm-library/';

  return {
    name: 'flm-json-libraries',
    buildStart() {
      libraries = discoverLibraries(root);
      for (const library of libraries) {
        this.addWatchFile(library.jsonPath);
        for (const icon of library.icons) {
          this.addWatchFile(icon.file);
          if (!server) this.emitFile({ type: 'asset', fileName: icon.path, source: readFileSync(icon.file) });
        }
        for (const [i, source] of library.sourceFiles.entries()) {
          this.addWatchFile(source.file);
          if (!server && library.emitted)
            this.emitFile({
              type: 'asset',
              fileName: library.descriptor.sources[i].path,
              source: readFileSync(source.file),
            });
        }
      }
    },
    resolveId(id) {
      if (id === manifest || id.startsWith(prefix)) return '\0' + id;
    },
    load(id) {
      if (id === '\0' + manifest)
        return `export default [${libraries.map((l) => `Object.assign(${JSON.stringify(l.descriptor)},{load:()=>import(${JSON.stringify(prefix + l.descriptor.name)}).then(m=>m.default)})`).join(',')}];`;
      if (id.startsWith('\0' + prefix)) {
        const library = libraries.find((l) => l.descriptor.name === id.slice(prefix.length + 1));
        if (!library) throw new Error('Unknown FLM library module');

        return `export default JSON.parse(${JSON.stringify(readFileSync(library.jsonPath, 'utf8'))});`;
      }
    },
    configureServer(devServer) {
      server = devServer;
      server.watcher.add(resolve(root, 'libraries'));
      let timer: ReturnType<typeof setTimeout> | undefined;
      server.watcher.on('all', (_event, path) => {
        if (
          !path.startsWith(resolve(root, 'libraries') + sep) &&
          !path.startsWith(resolve(root, 'public/demo/code') + sep)
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          void devServer.restart();
        }, 150);
      });
      server.httpServer?.once('close', () => clearTimeout(timer));
      server.middlewares.use((request, response, next) => {
        let url: string;
        try {
          url = decodeURIComponent((request.url ?? '').split('?')[0]);
        } catch {
          next();

          return;
        }
        for (const library of libraries) {
          const icon = library.icons.find(
            (icon) => url === '/' + icon.path || url === devServer.config.base + icon.path,
          );
          if (icon) {
            response.setHeader('Content-Type', 'image/svg+xml');
            response.end(readFileSync(icon.file));

            return;
          }
          if (!library.emitted) continue;
          const index = library.descriptor.sources.findIndex(
            (s) => url === '/' + s.path || url === devServer.config.base + s.path,
          );
          if (index < 0) continue;
          response.setHeader('Content-Type', 'text/plain');
          response.end(readFileSync(library.sourceFiles[index].file));

          return;
        }
        next();
      });
    },
  };
}
