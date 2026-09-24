# Geometry Preview (web)

React + TypeScript port of the Qt/C++ Geometry Preview desktop app in the parent
directory. The C++ subset interpreter, SDK metadata, preview geometry, 3D viewport
(WebGL2) and all panels run entirely in the browser. There is no backend.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm test           # unit + differential tests (needs a C++20 compiler, see below)
npm run typecheck
```

## Behavior parity with the desktop app

The port is intended to behave identically to the C++ app. `README.md` and
`runtime/API_TRACE_SEMANTICS.md` in the parent directory describe the behavior
and apply here unchanged.

Parity is enforced by differential tests. `reference/build.sh` compiles the
**original** C++ interpreter and geometry engine (`../runtime`, `../geometry`,
which have no Qt dependency) into a small harness. The tests run every fixture in
`tests/fixtures/` through both implementations and compare everything: variables,
variable history, diagnostics, API calls with argument provenance, overload
resolution, parameter roles, debug anchors, every mesh vertex, warnings, Link
connector previews and evaluated expressions. The harness is rebuilt
automatically when the C++ sources change. It needs `c++` (clang or GCC) with
C++20.

Differences from the desktop app:

- WebGL cannot draw lines wider than 1 px. Wide lines, such as selection outlines
  and the selected vector, are drawn as screen-space quads instead.
- Docks are fixed bottom tabs. They cannot float or close.
- If a pathologically nested expression exhausts the JavaScript stack, the
  preview keeps its previous state and the status bar shows the error. The
  desktop app crashes on such input.
- File > Exit calls `window.close()`, which browsers usually ignore.

## Updating the SDK registries

The API signatures and SDK constants are converted from the parent project's
generated files (`../runtime/*.generated.inc`). After regenerating those from
the SDK headers, run `npm run generate`.
