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
  catalog: {
    label: string;
    categories: { id: string; name: string; elements: string[] }[];
    items: Record<string, { symbol: string; thumbnail: string }>;
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
      const svgFiles = readdirSync(path, { recursive: true, withFileTypes: true })
        .filter((file) => file.isFile() && /\.svg$/i.test(file.name))
        .map((file) => ({ file: join(file.parentPath, file.name), name: file.name }));
      const icons = new Map<string, { file: string; path: string }>();
      const json = files.filter((file) => /\.json$/i.test(file));
      if (!json.length) return [];
      if (json.length !== 1) throw new Error(`${name}: expected exactly one library JSON`);
      const jsonPath = join(path, json[0]);
      const parsed = readParsedLibrary(JSON.parse(readFileSync(jsonPath, 'utf8')));
      const codePath = files.some((file) => /\.(h|cpp)$/i.test(file)) ? path : join(root, 'public/demo/code', name);
      const codes = existsSync(codePath)
        ? readdirSync(codePath)
            .filter((file) => /\.(h|cpp)$/i.test(file))
            .sort()
        : [];
      if (!codes.some((file) => /\.cpp$/i.test(file)) || !codes.some((file) => /\.h$/i.test(file)))
        throw new Error(`${name}: add .h and .cpp beside the JSON (or in public/demo/code/${name})`);
      const registry = new Map<string, string>();
      const sourceFiles = codes.map((file) => ({ file: join(codePath, file), name: file }));
      const text = sourceFiles.map(({ file }) => sourceText(readFileSync(file)));
      for (const code of text)
        for (const [block, entry] of geometryRegistry(code)) {
          if (registry.has(block) && registry.get(block) !== entry)
            throw new Error(`${name}: ambiguous geometry ${block}`);
          registry.set(block, entry);
        }
      const entries: LibraryDescriptor['entries'] = {};
      const items: LibraryDescriptor['catalog']['items'] = {};
      for (const entity of Object.values(parsed.entities)) {
        const block = entity.geometry?.children.find((node) => node.tag === 'FNBLKNAME')?.text ?? '';
        const entry = registry.get(block);
        entries[entity.guid] = {
          entry: entry ?? '',
          ...(!entry
            ? { error: `${entity.id}: no registered geometry for ${block || '(no geometry definition)'}` }
            : {}),
        };
        const slide = entity.paths
          ?.find((p) => p.NAME === 'ENT_SMALLSLIDE')
          ?.value?.replace(/^.*[/\\]/, '')
          .replace(/\.(sld|slb|svg)$/i, '')
          .toLowerCase();
        const matches = slide ? svgFiles.filter((file) => file.name.toLowerCase() === slide + '.svg') : [];
        if (matches.length > 1) throw new Error(`${name}: ambiguous SVG for ${slide}`);
        const localIcon = matches[0];
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
        items[entity.guid] = { symbol: entity.names?.ENT_SYMBOL?.EN || entity.id, thumbnail };
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

      const categories = parsed.folders.map((f) => ({
        id: f.guid,
        name: f.names.NAME?.EN || f.guid,
        elements: collect(f.guid),
      }));
      const listed = new Set(categories.flatMap((c) => c.elements));
      const unlisted = Object.keys(items).filter((id) => !listed.has(id));
      if (unlisted.length) categories.push({ id: 'uncategorized', name: 'Uncategorized', elements: unlisted });
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
