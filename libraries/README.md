# JSON element libraries

Add one folder per library, containing the JSON exported by your Python converter
and its geometry `.h` / `.cpp` files. No XML or Python converter is used by this app.

```
libraries/MyLibrary/library.json
libraries/MyLibrary/MyGeometry.h
libraries/MyLibrary/MyGeometry.cpp
libraries/MyLibrary/icons/MyElement.svg
```

Supported JSON: `FLM-PACK-1` versions `2.0` and `2.1`, with
`2.1-columnar-en` library data. The unpacked `2.1-columnar-en` form is also accepted.
Keep specification GUIDs, row combinations and original restriction codes intact.

The Vite plugin discovers these files during development, tests and builds. It
registers folders/elements and matches each `FNBLKNAME` to the corresponding
`__GEO_NAME` / `__GEO_FN` entry in the geometry header. The application uses the
existing C++ interpreter; adding sources does not compile or run a native DLL.
Unregistered functions and unsupported active constraints report an error.

Existing libraries can reuse geometry files under `public/demo/code/<Library>`;
in that case only the JSON belongs in this folder. All runtime libraries come
from discovered JSON files. There is no second parameter catalog or legacy
resolver to fall back to.

Shared tables are decoded and indexed on demand. Dependency groups are compiled
when an element is resolved. Parameter changes are validated before parameters,
geometry and connector dimensions are committed together.

The current resolver supports the existing FLM table bindings and expression
defaults/bounds, conditional activation, correlated table rows and referenced
circular connector size tables. It keeps hidden variables in the graph and solves
coupled table components with bounded search. Unchanged table components reuse
cached solutions. The search budget is not a proof of impossibility: exhausting
it returns `unresolved` and prevents a geometry update.

Unknown active codes, missing references, unsupported technology table layouts,
ambiguous size rows and uninterpreted parent/child bindings remain unresolved.
They are preserved for implementation, not silently dropped. Adding a new JSON
schema or FLM dialect may require extending these interpreters. This is not a
claim that every definition in every XML library is already executable.

`CGeneral/CGeneral.json` is the supplied packed library, unchanged. The GRUNDFOS
and BELIMO JSONs contain the definitions available in the former bundled
catalogs, migrated to the normalized schema. All three use the same solver.
Migration cannot recover information absent from those catalogs. Missing or
unsupported definitions are reported instead of generating geometry from
unresolved values; replace those JSONs with complete exports when available.

SVG conversion is separate and optional. Place SVG files anywhere inside the
library folder. Their filenames match `ENT_SMALLSLIDE` (ignoring path, case and
the `.sld`, `.slb` or `.svg` extension). The plugin serves them in development
and includes them in the production build. Duplicate matches report an error.
Existing icon assets can be reused via the thumbnail-only index; this index
contains no parameters or restrictions. Elements without an SVG display their
name. Adding a library requires no edits to an example list or registration code
in the app. The source header must still register its geometry functions.

Run `npm run typecheck`, `npm test` and `npm run build` to validate a change.
Commit the JSON and geometry sources; no generated example list is maintained by hand.
