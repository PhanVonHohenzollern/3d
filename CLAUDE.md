# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is a browser port (Vite + React 19 + TypeScript 7, CodeMirror 6, raw WebGL2) of the Qt/C++ Geometry Preview app in the parent directory `..`. It is a nested git repo. The parent is the original C++ project, and its `CLAUDE.md`, `README.md` and `runtime/API_TRACE_SEMANTICS.md` describe the behavior this port must reproduce.

**Core rule: the port is behavior-identical to the C++.** Every TypeScript module mirrors one C++ file: same class, method and helper names, same control flow, same comments and diagnostic/warning texts. When you change behavior here, check whether the C++ changed too, and keep the two in step.

## Commands

```sh
npm run dev                       # dev server
npm run build                     # tsc --noEmit && vite build
npm run typecheck
npm test                          # all vitest tests
npx vitest run tests/runtime.diff.test.ts          # one test file
FIXTURE=loops npx vitest run tests/runtime.diff.test.ts   # only fixtures whose path contains "loops"
npm run reference                 # rebuild the C++ reference harness manually
npm run generate                  # re-convert ../runtime/*.generated.inc into src/runtime/*.generated.ts
```

## Differential testing (the main safety net)

`reference/harness.cpp` is compiled by `reference/build.sh` from the **original** `../runtime/*.cpp` and `../geometry/*.cpp` sources. Those files have no Qt dependency. `tests/support/reference.ts` rebuilds the harness whenever it or any C++ source is newer than the binary. The harness prints every observable output of a fixture as JSON. The `tests/*.diff.test.ts` files produce the same JSON from the TypeScript modules and compare them with `tests/support/compare.ts`:

- `runtime.diff`: `GeometryRuntime` output (result, source histories, `evaluateNumericExpression`).
- `semantics.diff`: `ApiMetadata` overload choice, `ApiSemantics`, `DebugAnchorResolver`. The input is the C++ runtime's result, decoded from JSON.
- `geometry.diff`: `PreviewGeometryEngine` and literal-only connectors. The input is also the C++ result.
- `pipeline.diff`: the full TypeScript pipeline end to end, including expression-valued connectors.

Number comparisons use a relative tolerance: 1e-9, or 2e-5 for float mesh data, to absorb last-ulp libm differences. Strings must match exactly after mapping libc++ and libstdc++ exception texts to one canonical form.

Fixtures are C++ snippets in `tests/fixtures/{runtime,geometry,semantics,shared}/`. Directives go in comments: `//@line N` (cursor line to run to; repeatable; default is the last line), `//@param key=value` (a `get_val` id), `//@eval expr` and `//@connector type|orientation|diameter|a|b|x,y,z|a,b,g[|name|point]`. When you fix a bug or add behavior, add a fixture. The expected output always comes from the C++, never written by hand. `tests/fixtures/semantics/overloads_*.cpp` were generated from the signature registry: one call per overload of every API named in `ApiSemantics`.

UI and renderer logic that the harness cannot cover has ordinary unit tests in `tests/ui/` and `tests/renderer/`.

## Porting conventions (shared by all modules)

- **Values** (`src/runtime/RuntimeValue.ts`) map the C++ variant: `std::monostate` → `undefined`, `double` → `number`, `int64` → **`bigint`**, `bool`, `string`. `FdPoint3d`/`FdVector3d` are **immutable** classes; C++ in-place mutators return new values and the interpreter writes them back. `RuntimeArray` is a shared mutable reference, like `shared_ptr`, so deep-copy (`runtimeDeepCopy`) exactly where the C++ copies.
- **C++ library behavior** lives in `src/runtime/CppCompat.ts`: exact printf `%f/%g/%e` (`formatFixed`/`formatGeneral`, also used for `QString::number`), `strtod`/`stod`/`stoll`, `CppException` with libstdc++ `what()` texts, and x86-64 `double→int64` conversion. Don't substitute `toFixed`/`parseFloat`.
- **Floating point:** keep the C++ operation order. Apply `Math.fround` wherever the C++ uses `float` (mesh vertices, colors). The harness is built with `-ffp-contract=off` so the reference doesn't fuse multiply-adds into FMA.
- **Faithful quirks:** the port intentionally reproduces some odd C++ interpreter behavior (see "Known C++ quirks" below). Fix these in the C++ and the TypeScript together, with a fixture, or not at all.

## Architecture

Pipeline, same as `MainWindow::runPreview()` in the C++: `CodeEditor` text change or cursor move → 220 ms debounce → `GeometryRuntime.discoverParameters(wholeSource)` → `executeUpToLine(source, cursorLine)` → panels → `PreviewGeometryEngine.build()` → `Viewport3D` → Link panel → API focus. It all runs synchronously on the main thread.

- `src/runtime/`: the interpreter (`GeometryRuntime.ts`: `Lexer` → `ProgramParser` → `ExprParser` → `RuntimeExecutor`), the SDK registries (`*.generated.ts`: generated, never hand-edited), overload resolution, parameter semantics and debug anchors.
- `src/geometry/`: mesh adapters and builders (`appendPrimitiveApiMeshes`/`appendCompositeApiMeshes` → `build...Mesh`). `ConnectorPreview` builds a synthetic `makeVerySimpleTube`/`makeBox` call and runs it through `build()`.
- `src/renderer/`:
  - `ViewportEngine.ts` is the framework-free port of the C++ `Viewport3D` class (camera, picking, hover, API focus, GPU buffers). `Viewport3D.tsx` is a thin React wrapper.
  - `Viewport3DHandle.ts` is the imperative contract the App uses (method-for-method the C++ public API). It also holds `apiDebugItemId()`, the `@api<index>:<point|vector>:<parameter>` ID format shared with API Trace.
  - `Matrix4x4.ts` ports `QMatrix4x4`. `OverlayPainter.ts` ports the QPainter subset used for the overlay. `WideLines.ts` draws >1 px lines as quads.
- `src/app/App.tsx`: a `MainWindow` class ported line by line, plus the layout component. `Action.ts`, `MenuBar.tsx`, `StatusBar.tsx` and `Splitter.tsx` are small Qt stand-ins.
- `src/ui/`: each panel keeps its state in a synchronous model object (`ApiTraceModel`, `LinkModel`, `ApiHistoryModel`, …) that also serves as the component's ref handle. MainWindow's call sequences read state back immediately and rely on callbacks firing mid-call, which React state updates cannot do. `TreeWidget.ts` ports QTreeWidget's signals and selection rules. Keep the App ↔ panel call order identical to the C++.
- `src/editor/CodeEditor.tsx`: a CodeMirror 6 wrapper with an imperative handle (`currentLine`, `setTraceSourceLines`, navigation, cursor-line insertion).

## Known C++ quirks reproduced on purpose

Found while porting. They are behavior of the original app, not port bugs:

- A `while` loop runs the statement after the loop first, then its body once. A top-level `while` block is parsed as a call to a function named `while`.
- A helper whose body is a single call to another helper records that inner call twice. The second record has `parentApiIndex` -1.
- A statement containing `.normalize(`, `.rotateBy(`, `.mirror(` or `.set(` anywhere, even inside call arguments, is treated as a mutating call on its left-hand side.
- An unbalanced `(` makes the rest of the file one statement that never runs.
- `README.md` in the parent describes a `PARTIAL PREVIEW` viewport badge, but the C++ viewport never draws one, so neither does the port.
