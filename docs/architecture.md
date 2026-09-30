# Architecture

The app has two parts with different rules:

- **The engine** interprets FLM3Geo C++ scripts and turns API calls into meshes. It has no React and no DOM, and it has its own tests. It lives in `engine/`, outside `src/`, and the app uses it like a package.
- **The app** in `src/` is the React UI: editor, 3D viewport, inspector panels. It follows [Feature-Sliced Design](https://feature-sliced.design/) (FSD).

Everything in `src/` lives in one of the six layers below; `npm run lint` fails for a file anywhere else. The migration map at the end records where the old folders (`components/`, `hooks/`, `helpers/`, `types/`, `utils/`, `lib/`, `core/`) went.

## Layout

```
engine/                  framework-free C++ interpreter and geometry
  runtime/               lexer, parser, interpreter, SDK metadata
  geometry/              API adapters and mesh builders
  formats/               OBJ read and write
  math/                  vectors and matrices
src/
  app/                   entry point, theme, global styles
  pages/workspace/       the one page: composes widgets, owns the models, syncs selection, keyboard shortcuts
  widgets/               self-contained blocks: code-editor, viewport, parameter-panel, …
  features/              user actions: run-preview, edit-parameters, manage-functions, …
  entities/              domain data: parameter, api-call, variable, connector, source-function
  shared/                generic code with no domain knowledge: ui/, lib/, config/
```

## Import rules

A layer imports only from layers below it:

| Layer      | May import                                               |
| ---------- | -------------------------------------------------------- |
| `app`      | pages, widgets, features, entities, shared, engine       |
| `pages`    | widgets, features, entities, shared, engine              |
| `widgets`  | features, entities, shared, engine                       |
| `features` | entities, shared, engine                                 |
| `entities` | shared, engine                                           |
| `shared`   | engine (only `engine/math`, for vector and matrix types) |
| `engine`   | nothing in `src/`                                        |

Four more rules:

1. **Every import starts with `@`.** Import project code through its alias: `@/…` for `src/`, `@tests/…` for `tests/`, and `@engine/…` for `engine/`. This applies to files in the same folder too. Relative (`./`, `../`) and absolute (`src/…`, `/…`) imports fail `npm run lint`.
2. **Public API only.** Every slice (`features/run-preview`, `entities/parameter`, …) and every engine package has an `index.ts`. From outside the slice, import that file, never a file inside it: `@/entities/parameter`, not `@/entities/parameter/model/key`.
3. **No imports between slices on the same layer.** One feature does not import another feature, and one widget does not import another widget. Composition happens one layer up: the page places both widgets. If two entities really need each other, use an FSD `@x` file (`entities/api-call/@x/variable.ts`) so the dependency is explicit, and add an `except` entry for it in `eslint.boundaries.config.js`.
4. **Engine through its packages.** App code imports `@engine/runtime`, `@engine/geometry`, `@engine/formats` or `@engine/math`, never a deeper path. The same holds between engine packages: `geometry` imports `@engine/runtime` and `@engine/math`, not their files. Inside one package, files import each other directly, since going through the package's own `index.ts` would create cycles.

### How the rules are checked

| Rule                                                                                | Checked by                                                                                  | Mode now |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| Every import starts with `@` (rule 1)                                               | `npm run lint` (`no-restricted-imports` in `eslint.config.js`)                              | error    |
| Engine through its packages (rule 4); the engine imports no app or test code        | `npm run lint` (`no-restricted-imports` in `eslint.config.js`)                              | error    |
| Layer direction, public API, no cross-slice imports (rules 2–3 and the table above) | `npm run lint:boundaries` (`import-x/no-restricted-paths` in `eslint.boundaries.config.js`) | error    |
| Engine packages import each other through `index.ts` (rule 4)                       | `npm run lint:boundaries` (`import-x/no-restricted-paths` in `eslint.boundaries.config.js`) | error    |
| No import cycles                                                                    | `npm run lint:boundaries` (`import-x/no-cycle`)                                             | error    |
| Folder structure inside a slice (segment names, an `index.ts` per slice)            | code review                                                                                 | —        |

`lint:boundaries` reads the slice folders on every run, so a new slice is checked as soon as it exists. It runs in `npm run validate` and in CI, and any finding fails the run (GPW-38). It is a separate config because resolving every import for these rules is slower than the rest of `npm run lint`.

`no-cycle` only sees runtime imports: it skips `import type`. The type-only cycles known at the start of the migration are gone (GPW-15, GPW-45): metadata interfaces live in `*.types.ts` files, panel handle types live with their models, and the expression parser depends on an `EvalContext` interface instead of `RuntimeState`. One type-only cycle is left on purpose: a `TreeWidgetItem` knows its `TreeWidget`.

At the start of the migration (branch `chore/p1-guardrails`), `lint:boundaries` reported 10 warnings and no cycles:

- 6 are the viewport importing app helpers (`qtInput`, `debugItems`, `debugValueText`).
- 4 are `types/` importing from `hooks/` (`Action`, `TreeWidget`, `TreeWidgetItem`).
- The engine already imports nothing from app code.

After P2 (`shared/` layer): 3 warnings, all the viewport importing the API-call helpers that move to `entities/api-call` in GPW-23. After GPW-23: 0 warnings. After P5, `lint:boundaries` also warns when `features/` imports app code; none does, and no feature imports another. `shared/` imports no app code, and `lint:boundaries` now warns if it does. After P6 the old folders are gone, the rules report nothing, and GPW-38 made them errors.

## Where does new code go?

Ask these in order and stop at the first yes:

1. **Does it parse or run C++, know an SDK API, or build meshes, and does it work without React?** Put it in `engine/`.
2. **Would it make sense in any other app?** Examples: a button, a splitter, an Observable, `cn()`, a WebGL buffer wrapper. Put it in `shared/`.
3. **Is it data about one domain thing and how to show it?** Examples: a parameter key, API-call formatting, a variable row. Put it in `entities/<thing>`.
4. **Is it one thing the user does?** Examples: run the preview, edit a parameter, add a function tab, import an OBJ. Put it in `features/<action>`.
5. **Is it a block on screen that combines several of those?** Put it in `widgets/<block>`.
6. **Does it coordinate several widgets?** An example is selection sync between the editor, viewport and trace. Put it in `pages/workspace`.
7. **Is it app start-up or truly global?** Put it in `app/`.

Keep code local until a second user needs it, and then move it down a layer. Do not create `helpers/`, `utils/` or `common/` folders inside slices for code that has a real owner.

## Segments

Inside a slice, group files by purpose:

| Segment    | Contains                                                             |
| ---------- | -------------------------------------------------------------------- |
| `ui/`      | React components                                                     |
| `model/`   | state: Observable models, `use*` hooks that connect a model to React |
| `lib/`     | pure functions used by the slice                                     |
| `config/`  | constants                                                            |
| `index.ts` | the slice's public API                                               |

A `use*` hook lives in the `model/` segment of the slice that owns its state. Classes that are not hooks (models, controllers) also live in `model/`, never in a folder called `hooks/`.

## State

- **Domain state goes in Observable models** in a `model/` segment: build results, parameter values, function tabs, connectors. React subscribes with `useObservable`.
- **React state is only for short-lived UI:** whether a dialog is open, text typed into a field before it is applied, hover.
- **Models are created by their owner and passed down.** The page (or a feature) creates a model once and hands it to components through props or context. Components do not create domain models and hand them back up with `useImperativeHandle`.
- **No injected change callbacks.** Other code subscribes to a model instead of calling `setChangedCallback`-style setters.
- **The program runs in one place.** Only `features/run-preview` executes the C++ program. Other slices read its results.

## Engine rules

- Each engine package exports its public API from `index.ts`. App code uses only that; engine tests may import internals.
- The engine never imports from `src/`.
- SDK knowledge is registered in tables, not spread through the interpreter:
  - intrinsic functions: `engine/runtime/intrinsics/` has one module per family (parameter and connector queries, insulation queries, point operations, line intersection, program control) and one registry that the executor, the expression parser and source scanning all read. `language` intrinsics such as `get_val` run before the program's own functions; `sdk` ones such as `setpt` run after them, so a helper with the same name replaces them. The expression parser has no side effects (GPW-43)
  - value types: `engine/runtime/values/` has a `ValueType` per SDK type (`pointVector.ts`, `bowl.ts`) with its constructor, default, conversion, copy, description, methods and fields, listed in `registry.ts`. `values/core.ts` is the value model below the registry and `RuntimeValue.ts` the operations on top of it; mutating methods live in one table (`helpers/mutatingMethods.ts`) and `std::vector` front/back in `values/stdVector.ts` (GPW-44)
  - preview adapters: each module in `engine/geometry/adapters/` exports an `AdapterTable` with one entry per API name, and `apiAdapters.ts` merges the tables and rejects a name registered twice. Adapters never branch on the API name; a variant is an option chosen in the table (GPW-40)
- An adapter never imports another adapter (`npm run lint:boundaries`). Shared drawing code lives in `geometry/builders` (meshes: strokes, bowls, section tubes, boxes) and `geometry/helpers` (`withAdapterErrors`, `MeshSketch`/`FrameSketch`, `deg`, `ellipsePoint`, `sweepAlongArc`); display sizes and sampling caps are named in `geometry/config/previewConstants.ts` (GPW-41).
- Adapters read arguments only through `NamedArguments`, by the parameter names of the call's resolved overload; strict readers (`point`, `fdVector`, `real`, `int`, `flag`, `pointArray`, …) require the SDK type, lenient ones (`vector`, `num`, `count`, …) accept what the SDK would convert, and `optionalFlag`/`optionalInt`/`optionalReal` give a fallback for optional settings. When an argument is wrong, the adapter throws an `Error` that names it; `withAdapterErrors` reports it as a warning on the call and the call counts as drawn. A call with no matching SDK overload never reaches an adapter: the engine warns that its arguments or overload are unsupported (GPW-42).
- The interpreter: `RuntimeExecutor` picks the entry function and wires one `Execution` shared by `StatementExecutor`, `DeclarationEvaluator` and `FunctionCalls` (each under 400 lines). `RuntimeState` keeps its storage private; a program function call is a `pushFrame`/`popFrame` pair with a fresh `ControlFlow`, and every write that belongs in the variable history goes through `recordChange` (GPW-45).
- Expressions are parsed once into a tree (`interpreter/expressions.ts`, cached per token array) and evaluated by `evaluator.ts`; a syntax error is an `error` node, so evaluation still runs what comes before it, as the old parse-while-evaluating interpreter did. Simple statements are classified once (`simpleStatements.ts`). Paths such as `a[i].front().x` are read by one function, `parsePathSteps`, for reads, assignments and source tracing, and bracket nesting by one walker, `scanTopLevel` (GPW-46).
- The viewport: `ViewportEngine` is the public face the hooks and tests use, and wires the parts in `widgets/viewport/lib/render/`: `ViewportState` (what is shown and selected, and the visibility rules), `CameraController` (camera, scene scale, axes, fitting), `PickingService` (hit testing and Unite pick cycling), `OverlayLayer` (label panels, buttons, 2D drawing), `SceneRenderer` (the GL vertex buffer and draw calls), `ViewportInput` (drag, click, hover) and `SurfaceBinding` (canvases, GL context, frame scheduling). Colours, line widths and thresholds are named in `widgets/viewport/config/viewport.ts`. Each part is under 400 lines (GPW-47).
- Rendering is a Bridge. `SceneRenderer` decides what to draw and in which order; a `RenderBackend` (`widgets/viewport/lib/render/backend/`) owns the GPU device and turns those calls into GPU work. `WebGL2Backend` is the only backend so far, and `createRenderBackend()` picks the backend. Nothing outside `backend/` mentions WebGL. `tests/renderer/sceneDraws.test.ts` records the calls a backend receives for a set of viewport states, and every backend must receive exactly those calls.
- Geometry reads resolved API calls from the runtime. It reads the overload from `call.signature` and the arguments with defaults from `effectiveApiArguments`; it does not resolve overloads or fill in defaults itself (GPW-39).

## Migration map

Old location → new location, with the ticket that moves it. Each ticket updates this table when it lands.

| Old                                                                                                                                                                  | New                                                                                                                                                   | Ticket        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/components/ui/*` (shadcn primitives, `ComboBox`, `FormLabel`, `LineEdit`, `PushButton`, `ToolButton`)                                                           | `src/shared/ui/`                                                                                                                                      | GPW-15 (done) |
| `EditableComboBox`, `FloatingWindow`, `TableView`, `PanelHeader`, `Splitter` + `ResizeHandle`, `PaginationControls`, `TreeView`, with their hooks, types and helpers | `src/shared/ui/{editable-combo-box,floating-window,table-view,panel-header,splitter,pagination,tree}/`                                                | GPW-15 (done) |
| `src/helpers/layout.ts` splitter, floating-window and tree parts                                                                                                     | `src/shared/ui/{splitter,floating-window,tree}/`; the dock parts stay in `src/helpers/layout.ts`                                                      | GPW-15 (done) |
| `src/hooks/treeWidget/{TreeWidget,TreeWidgetItem}.ts`, `src/types/treeView.ts`                                                                                       | `src/shared/ui/tree/`                                                                                                                                 | GPW-15 (done) |
| `src/hooks/observable/*`, `useObservable`, `Signal`                                                                                                                  | `src/shared/lib/observable/`                                                                                                                          | GPW-16 (done) |
| `Action`, `useAction`                                                                                                                                                | `src/shared/lib/action/`                                                                                                                              | GPW-16 (done) |
| `src/types/{qt,input}.ts`, `src/helpers/{qtInput,keyboard}.ts`                                                                                                       | `src/shared/lib/qt/`                                                                                                                                  | GPW-16 (done) |
| `src/utils/{textMetrics,CanvasTextMeasurer,measureText}.ts`, `src/types/text.ts`                                                                                     | `src/shared/lib/text/`                                                                                                                                | GPW-16 (done) |
| `src/utils/painting.ts`, `src/types/painting.ts`                                                                                                                     | `src/shared/lib/painting/`                                                                                                                            | GPW-16 (done) |
| `usePointerDrag`, `useCompactLayout`, `useScrollSelectionIntoView`                                                                                                   | `src/shared/lib/react/`                                                                                                                               | GPW-16 (done) |
| `SingleShotTimer`, `src/utils/{dom,events,sets,arrays,regexp,platform}.ts`                                                                                           | `src/shared/lib/`                                                                                                                                     | GPW-16 (done) |
| `src/utils/{Vector3D,Matrix4x4,Rect,Bounds3D,geometry,math}.ts` (the viewport's Qt-style render math)                                                                | `src/widgets/viewport/` with the viewport, its only user                                                                                              | GPW-34 (done) |
| `src/utils/cn.ts`, `src/lib/utils.ts`                                                                                                                                | `src/shared/lib/cn.ts` (one version, with tailwind-merge)                                                                                             | GPW-17 (done) |
| `src/core/viewport/glProgram.ts`                                                                                                                                     | `src/shared/lib/webgl/`                                                                                                                               | GPW-18 (done) |
| `src/core/viewport/{VertexArray,lineQuads,shaders,panelLayout}.ts` (this viewport's vertex format, shaders and label layout)                                         | `src/widgets/viewport/`                                                                                                                               | GPW-34 (done) |
| `src/hooks/useTheme.ts` (stores the app's theme choice)                                                                                                              | `src/app/`                                                                                                                                            | GPW-37 (done) |
| `src/core/runtime`, `src/core/geometry`, `src/core/formats`                                                                                                          | `engine/runtime`, `engine/geometry`, `engine/formats`, each with an `index.ts`                                                                        | GPW-19 (done) |
| `src/utils/{cpp,cppStd}.ts`                                                                                                                                          | `engine/runtime/cpp/` (`what()` and number formatting are exported from `@engine/runtime`)                                                            | GPW-19 (done) |
| `src/utils/{DVec3,dmat4}.ts`                                                                                                                                         | `engine/math/`                                                                                                                                        | GPW-19 (done) |
| `src/helpers/functions.ts` C++ parsing (function signatures, typed inputs)                                                                                           | `engine/runtime/analysis/sourceFunctions.ts`; the CodeMirror tree walks stay in `src/helpers/functions.ts`                                            | GPW-20 (done) |
| `engine/runtime/helpers/parameters.ts` source scanner                                                                                                                | `engine/runtime/analysis/parameterScan.ts`; the value conversions stay in `helpers/parameters.ts`                                                     | GPW-20 (done) |
| `engine/runtime/helpers/preprocessor.ts`                                                                                                                             | `engine/runtime/interpreter/preprocessor.ts`                                                                                                          | GPW-20 (done) |
| `src/utils/{DVec3,dmat4}.ts` (the engine's model math)                                                                                                               | `engine/math/` (moved in GPW-19); not merged with the render math, see the open decisions below                                                       | GPW-21 (done) |
| `src/helpers/{parameters,parameterTable}.ts`, `ParameterRow`/`ParameterEditor` from `src/types/panels.ts`; new `isFunctionParameterKey` and `parameterSlotCount`     | `src/entities/parameter/{lib,model}/`                                                                                                                 | GPW-22 (done) |
| `src/helpers/{traceFormatting,apiHistory,debugItems,debugValueText}.ts`, `src/hooks/apiTrace/{traceItems,historyItems,TraceTree}.ts`                                 | `src/entities/api-call/{lib,ui}/`                                                                                                                     | GPW-23 (done) |
| `src/helpers/variables.ts`, `VariableRow` from `src/types/panels.ts`                                                                                                 | `src/entities/variable/{lib,model}/`                                                                                                                  | GPW-24 (done) |
| `src/helpers/link.ts`                                                                                                                                                | `src/entities/connector/lib/`                                                                                                                         | GPW-24 (done) |
| `src/types/linkTable.ts` (component props)                                                                                                                           | with the Link panel widget                                                                                                                            | GPW-33 (done) |
| `src/hooks/mainWindow/FunctionWorkspace.ts`, `src/helpers/functions.ts` (editor-side function parsing)                                                               | `src/entities/source-function/{model,lib}/`                                                                                                           | GPW-25 (done) |
| running the preview, the scene/result/feedback, preview mode and the per-tab Build cache (from `MainWindow`); Build/Debug buttons (from `App.tsx`)                   | `src/features/run-preview/` (`PreviewSession`, `PreviewModeToggle`)                                                                                   | GPW-27 (done) |
| `src/hooks/parameterPanel/ParameterPanelModel.ts`, `src/hooks/useParameterPanel.ts`, the table dialog from `ParameterPanel.tsx`                                      | `src/features/edit-parameters/{model,ui}/`                                                                                                            | GPW-29 (done) |
| function-tab actions (from `MainWindow`), `src/components/FunctionEditor/`, `src/components/SubParameterPanel.tsx`                                                   | `src/features/manage-functions/` (`FunctionTabsController`, `FunctionEditor`, `SubParameterPanel`)                                                    | GPW-30 (done) |
| `src/hooks/linkPanel/LinkPanelModel.ts`, `src/hooks/useLinkPanel.ts`, `src/components/LinkForm.tsx`, `src/types/linkForm.ts`                                         | `src/features/edit-connector/{model,ui}/`                                                                                                             | GPW-31 (done) |
| OBJ import and export logic (from `MainWindow`), `src/hooks/useModelFiles.ts`, `src/components/ModelFileControls.tsx`                                                | `src/features/model-files/`; the download helper goes to `src/shared/lib/download.ts`                                                                 | GPW-32 (done) |
| panel components and their models                                                                                                                                    | `src/widgets/{parameter,variable,api-trace,link}-panel/`                                                                                              | GPW-33 (done) |
| editor, viewport, header and menus                                                                                                                                   | `src/widgets/{code-editor,viewport,workspace-header}/`                                                                                                | GPW-34 (done) |
| `src/components/DockArea.tsx`, `src/hooks/useDockArea.ts`, `src/helpers/layout.ts`, `src/types/dockArea.ts`                                                          | `src/shared/ui/dock/` (generic `DockArea`, `useDockHeight`); the inspector's tabs, icons and hints go to `src/pages/workspace/`                       | GPW-35 (done) |
| `src/components/App.tsx`, the rest of `MainWindow`                                                                                                                   | `src/pages/workspace/` (`WorkspacePage`, `WorkspaceModel`, `SelectionSync`, `StatusBarModel`); the page creates the panel models and passes them down | GPW-36 (done) |
| `src/main.tsx`, `src/index.css`, `src/hooks/useTheme.ts`                                                                                                             | `src/app/` (`main.tsx`, `App`, `model/useTheme`, `styles/index.css`); the keyboard shortcuts stay with the page, whose actions they trigger           | GPW-37 (done) |

### Left in the old folders after P4

`src/lib/` went in GPW-17; the rest moved in P5 and P6, and GPW-37 deleted the empty folders.

| File                                                                                                                     | Moves to                                                                      | Ticket                |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------- |
| `src/types/panels.ts`: Parameter and Link panel handle/props types, `ScrollRequest`                                      | `features/edit-parameters`, `features/edit-connector`, `shared/ui/table-view` | P5 (done)             |
| `src/types/panels.ts`: Variable and API Trace panel handle/props types                                                   | the panel widgets                                                             | GPW-33 (done)         |
| `src/types/linkForm.ts`, `src/types/linkTable.ts`                                                                        | the Link feature and widget                                                   | GPW-31, GPW-33 (done) |
| `src/types/modelFiles.ts`                                                                                                | `widgets/workspace-header`                                                    | GPW-34 (done)         |
| `src/types/editor.ts`                                                                                                    | `widgets/code-editor`                                                         | GPW-34 (done)         |
| `src/types/viewport.ts`, `src/types/viewportEngine.ts`, `src/helpers/viewportHandle.ts`, `src/helpers/viewportPoints.ts` | `widgets/viewport`                                                            | GPW-34 (done)         |
| `src/utils/{Vector3D,Matrix4x4,Rect,Bounds3D,geometry,math}.ts`                                                          | `widgets/viewport`                                                            | GPW-34 (done)         |
| `src/types/toolbar.ts`, `ActionListItem` and `Menu` from `src/types/mainWindow.ts` (the unused `MenuBar` is deleted)     | `widgets/workspace-header`                                                    | GPW-34 (done)         |
| `src/types/dockArea.ts`, `DockName`/`Dock` in `src/types/mainWindow.ts`, `src/helpers/layout.ts` (dock list and height)  | `shared/ui/dock`, `pages/workspace`                                           | GPW-35 (done)         |
| `src/types/statusBar.ts`                                                                                                 | `pages/workspace`                                                             | GPW-36 (done)         |

## Open decisions

These look like duplicates but behave differently in edge cases. Merging them would change output for degenerate input, so each needs a decision (ideally checked against the desktop app) before it is unified.

- **Two math kits.** `engine/math` (`DVec3`, `dmat4`) is double-precision model math. The viewport's `QVector3D` and `QMatrix4x4` follow Qt's semantics and store `Float32Array`s. Merging them would change the numbers in either the geometry output or the renderer.
- **`rotateAroundAxis` (geometry) vs `FdVector3d.rotateBy` (runtime).** Same Rodrigues formula; for a zero-length axis the first returns the vector unchanged, the second scales it by `cos(angle)`.
- **`stableBasis` / `sdkPerpVector` (geometry) vs `perpVector` (runtime).** Same 0.85 helper axis; they differ in the fallback threshold (below 1e-12 vs exactly 0) and in how a zero input is handled.
- **"Default up" threshold.** 0.85 in `geometryMath.ts` and `pointVectorMembers.ts`, 0.9 in `NamedArguments.ts` and `intersectionAdapters.ts`, 0.5 in `ConnectorPreview.ts`. Changing any of them can move generated geometry.
