# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Geometry Preview is a browser app, a port of a Qt/C++ desktop app: the user edits C++ geometry code against a proprietary SDK (FLM3Geo / `Fd*` types), and an in-process C++ subset interpreter runs it up to the cursor line and renders the SDK geometry calls. The stack is React 19, TypeScript 6, Vite, Tailwind 4, CodeMirror 6 and raw WebGL2. The repo is self-contained. The behavior spec lives in `docs/` (BEHAVIOR.md, API_TRACE.md, BUILTIN_CONSTANTS.md).

TypeScript stays on 6.x because typescript-eslint does not support TypeScript 7.

## Commands

```sh
npm run dev | build | typecheck | lint | lint:fix | format | format:check
npm test                                           # all vitest tests
npx vitest run tests/runtime.test.ts               # one test file
FIXTURE=loops npx vitest run tests/runtime.test.ts # only fixtures whose path contains "loops"
npm run update-expected                            # rewrite tests/fixtures/**/*.expected.json.gz from the current code
```

Before finishing any change, `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` must all pass.

## Code conventions

- **Folders:**
  - `src/components/`: React components, JSX only. They call hooks and render; they don't define helper functions. Reusable Qt-look widgets are in `src/components/ui/` (PushButton, LineEdit, ComboBox, TableView, FloatingWindow, …).
  - `src/hooks/`: custom hooks (`useXxx.ts`) hold all React-side logic. Panels whose call ordering must be synchronous keep a plain model class in `src/hooks/<feature>/` (e.g. `mainWindow/MainWindow.ts`, `apiTrace/ApiTracePanelModel.ts`, `treeWidget/TreeWidget.ts`). The hook owns the instance, and components reach the model only through the hook. Don't turn these into React state: callers read state back immediately and rely on callbacks firing mid-call.
  - `src/core/`: framework-free engines. `runtime/` is the interpreter and SDK metadata, `geometry/` the mesh adapters and builders, `viewport/` the WebGL engine.
  - `src/helpers/`: app-specific pure functions.
  - `src/utils/`: generic pure functions and classes (C++ library emulation, math, DOM and text utilities).
  - `src/types/`: shared types.
- **Styling:** Tailwind utility classes only. `src/index.css` holds just the Tailwind import, the `@theme` tokens (e.g. `bg-window`, `text-fg`, `border-line-strong`, `from-button-top`, `rounded-qt`, `font-code`, `text-ui`, `bg-viewport-*`) and a minimal base layer. Build conditional classes with `cn()` from `src/utils/cn.ts`. Never concatenate class fragments with a leading space (`' selected'`): prettier-plugin-tailwindcss strips it. Inline `style` only for values computed at runtime. CodeMirror is styled with `EditorView.theme` (`src/hooks/codeEditor/editorExtensions.ts`).
- **No comments.** Keep one only for a non-obvious "why" whose loss would likely cause a regression. There are currently six: the x86 `llround` conversion (`utils/cppStd.ts`), the lexer and error-stack performance notes (`core/runtime/interpreter/Lexer.ts`, `utils/cpp.ts`), the WebGL line-quad reason (`core/viewport/shaders.ts`), the re-entrant selection copy (`hooks/mainWindow/MainWindow.ts`) and the disabled-select opacity (`components/ui/ComboBox.tsx`).
- **ESLint** (`eslint.config.js`): typescript-eslint recommended, react-hooks `recommended-latest` (React Compiler rules), react-refresh, prettier. The `react-hooks/refs` rule flags any object with a `…Ref` member. Use callback refs (`bindEditor`, `bindViewport`, …) and destructure hook results that contain refs.
- Module names: hooks `useXxx.ts`, components `PascalCase.tsx`, class modules `PascalCase.ts`, function modules `camelCase.ts`.

## Behavior fidelity conventions

The engines reproduce the original C++ exactly, and the fixture tests enforce this:

- **Values:** `RuntimeValue` (`core/runtime/RuntimeValue.ts`) maps the C++ variant. `std::monostate` → `undefined`, `double` → `number`, `int64` → **`bigint`**, `bool`, `string`.
  - `FdPoint3d`/`FdVector3d` are **immutable** classes. Mutating members return new values, which the interpreter writes back.
  - `RuntimeArray` is a shared mutable reference. Deep-copy it only where the C++ copies.
- **C/C++ library behavior** is in `src/utils/cpp.ts` and `src/utils/cppStd.ts`: exact printf formatting (`formatFixed`/`formatGeneral`, also used for `QString::number`), `strtod`/`stod`/`stoll`, libstdc++ exception texts, x86-64 conversions, and `std::min`/`max`/`clamp`/`llround`/sort semantics. Never substitute `toFixed`/`parseFloat`.
- **Floating point:** keep the operation order. Use `Math.fround` wherever the C++ used `float` (mesh vertices, colors).
- **Where to extend:** add an SDK API adapter in `core/geometry/adapters/` and reuse or add a builder in `core/geometry/builders/`. SDK signatures and constants live only in `core/runtime/*.generated.ts`; these are data, don't reformat them. Per-overload parameter roles and anchors are in `core/runtime/ApiSemantics.ts`.

## Tests

- **Fixture tests:** each fixture is a C++ snippet in `tests/fixtures/{runtime,geometry,semantics,shared}/` with its `*.expected.json.gz`. Directives go in comments: `//@line N` (cursor line; repeatable; default is the last line), `//@param key=value` (a `get_val` id), `//@eval expr`, and `//@connector type|orientation|diameter|a|b|x,y,z|a,b,g[|name|point]`.
  - `runtime.test.ts` checks interpreter output, source histories and evals.
  - `semantics.test.ts` checks overload choice, roles and debug anchors.
  - `geometry.test.ts` checks meshes and literal-only connectors.
  - `semantics.test.ts` and `geometry.test.ts` run on the _expected_ runtime result, so they isolate their module.
  - `pipeline.test.ts` checks the whole document end to end. `tests/support/dump.ts` builds that document.
  - Numbers compare with a relative tolerance (1e-9; 2e-5 for float mesh data).
  - The committed expectations were captured from the original C++. Only run `npm run update-expected` for an intentional behavior change, and review the diff.
- **Unit tests:** `tests/ui/` and `tests/renderer/` cover UI models and viewport math, picking and layout.

## Architecture

The preview pipeline is `MainWindow.runPreview()` in `src/hooks/mainWindow/MainWindow.ts`:

1. A `CodeEditor` text change or cursor move starts a 220 ms debounce.
2. `GeometryRuntime.discoverParameters(wholeSource)` fills the Parameters panel.
3. `executeUpToLine(source, cursorLine)` produces an immutable `RuntimeResult`.
4. The result goes to the panels, then `PreviewGeometryEngine.build()`, then the `Viewport3D` handle, then the Link panel, then API focus.

Everything runs synchronously on the main thread. Selection, API focus and trace browsing only read the captured snapshots and never re-execute code.

- **`core/runtime/`:** `GeometryRuntime.ts` is the facade. `interpreter/` holds `Lexer`, `ProgramParser`, `ExprParser`, `RuntimeExecutor` and `RuntimeState`; `helpers/` holds value operations, built-ins, members, macros, parameters and API-call records.
- **`core/geometry/`:** `PreviewGeometryEngine.build()` walks the API calls, tracking color and transform state, and hands each call to `adapters/apiAdapters.ts`. `ConnectorPreview` builds a synthetic `makeVerySimpleTube`/`makeBox` call and runs it through `build()`.
- **`core/viewport/`:** `ViewportEngine` handles camera, picking, hover, API focus and draw order. `ViewportRenderer`/`shaders` draw every line as a clipped quad. `DebugLabelPanel` drives the Points/Vectors lists. `components/Viewport3D.tsx` + `hooks/useViewport3D.ts` expose it through the `Viewport3DHandle` contract in `types/viewport.ts`. API debug items use the ID format from `helpers/debugItems.ts`, which API Trace shares.

## Known C++ quirks reproduced on purpose

These are behavior of the original app, not port bugs:

- A `while` loop runs the statement after the loop first, then its body once. A top-level `while` block parses as a call to a function named `while`.
- A helper whose body is a single call to another helper records that inner call twice. The second record has `parentApiIndex` -1.
- A statement containing `.normalize(`, `.rotateBy(`, `.mirror(` or `.set(` anywhere, even inside call arguments, is treated as a mutating call on its left-hand side.
- An unbalanced `(` makes the rest of the file one statement that never runs.
