# Architecture

The app has two parts with different rules:

- **The engine** interprets FLM3Geo C++ scripts and turns API calls into meshes. It has no React and no DOM, and it has its own tests. It lives in `engine/`, outside `src/`, and the app uses it like a package.
- **The app** in `src/` is the React UI: editor, 3D viewport, inspector panels. It follows [Feature-Sliced Design](https://feature-sliced.design/) (FSD).

The code is moving to this layout ticket by ticket (see the migration map below). Until that is finished, the old folders (`components/`, `hooks/`, `helpers/`, `types/`, `utils/`, `lib/`, `core/`) still exist. New code goes into the new layout.

## Layout

```
engine/                  framework-free C++ interpreter and geometry
  runtime/               lexer, parser, interpreter, SDK metadata
  geometry/              API adapters and mesh builders
  formats/               OBJ read and write
  math/                  vectors and matrices
src/
  app/                   entry point, providers, global styles, global shortcuts
  pages/workspace/       the one page: composes widgets, owns the models, syncs selection
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
4. **Engine through its packages.** App code imports `@engine/runtime`, `@engine/geometry`, `@engine/formats` or `@engine/math`, never a deeper path.

### How the rules are checked

| Rule                                                                                | Checked by                                                                                  | Mode now |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| Every import starts with `@` (rule 1)                                               | `npm run lint` (`no-restricted-imports` in `eslint.config.js`)                              | error    |
| Engine through its packages (rule 4); the engine imports no app or test code        | `npm run lint` (`no-restricted-imports` in `eslint.config.js`)                              | error    |
| Layer direction, public API, no cross-slice imports (rules 2–3 and the table above) | `npm run lint:boundaries` (`import-x/no-restricted-paths` in `eslint.boundaries.config.js`) | warning  |
| No import cycles                                                                    | `npm run lint:boundaries` (`import-x/no-cycle`)                                             | warning  |
| Folder structure inside a slice (segment names, an `index.ts` per slice)            | code review                                                                                 | —        |

`lint:boundaries` reads the slice folders on every run, so a new slice is checked as soon as it exists. It runs in `npm run validate` and in CI but only warns during the migration; GPW-38 turns it into errors. It is a separate config so `npm run lint` keeps allowing zero warnings.

`no-cycle` only sees runtime imports: it skips `import type`. The four cycles known at the start of the migration all go through a type-only import, so they are not reported. GPW-15 and GPW-45 remove them.

At the start of the migration (branch `chore/p1-guardrails`), `lint:boundaries` reported 10 warnings and no cycles:

- 6 are the viewport importing app helpers (`qtInput`, `debugItems`, `debugValueText`).
- 4 are `types/` importing from `hooks/` (`Action`, `TreeWidget`, `TreeWidgetItem`).
- The engine already imports nothing from app code.

After P2 (`shared/` layer): 3 warnings, all the viewport importing the API-call helpers that move to `entities/api-call` in GPW-23. After GPW-23: 0 warnings. `shared/` imports no app code, and `lint:boundaries` now warns if it does.

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
  - intrinsic functions (GPW-43)
  - value types such as `FdBowlInfo` (GPW-44)
  - preview adapters, one entry per API name (GPW-40)
- Geometry reads resolved API calls from the runtime. It does not re-resolve overloads or fill in default arguments itself (GPW-39).

## Migration map

Old location → new location, with the ticket that moves it. Each ticket updates this table when it lands.

| Old                                                                                                                                                                  | New                                                                                                        | Ticket         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| `src/components/ui/*` (shadcn primitives, `ComboBox`, `FormLabel`, `LineEdit`, `PushButton`, `ToolButton`)                                                           | `src/shared/ui/`                                                                                           | GPW-15 (done)  |
| `EditableComboBox`, `FloatingWindow`, `TableView`, `PanelHeader`, `Splitter` + `ResizeHandle`, `PaginationControls`, `TreeView`, with their hooks, types and helpers | `src/shared/ui/{editable-combo-box,floating-window,table-view,panel-header,splitter,pagination,tree}/`     | GPW-15 (done)  |
| `src/helpers/layout.ts` splitter, floating-window and tree parts                                                                                                     | `src/shared/ui/{splitter,floating-window,tree}/`; the dock parts stay in `src/helpers/layout.ts`           | GPW-15 (done)  |
| `src/hooks/treeWidget/{TreeWidget,TreeWidgetItem}.ts`, `src/types/treeView.ts`                                                                                       | `src/shared/ui/tree/`                                                                                      | GPW-15 (done)  |
| `src/hooks/observable/*`, `useObservable`, `Signal`                                                                                                                  | `src/shared/lib/observable/`                                                                               | GPW-16 (done)  |
| `Action`, `useAction`                                                                                                                                                | `src/shared/lib/action/`                                                                                   | GPW-16 (done)  |
| `src/types/{qt,input}.ts`, `src/helpers/{qtInput,keyboard}.ts`                                                                                                       | `src/shared/lib/qt/`                                                                                       | GPW-16 (done)  |
| `src/utils/{textMetrics,CanvasTextMeasurer,measureText}.ts`, `src/types/text.ts`                                                                                     | `src/shared/lib/text/`                                                                                     | GPW-16 (done)  |
| `src/utils/painting.ts`, `src/types/painting.ts`                                                                                                                     | `src/shared/lib/painting/`                                                                                 | GPW-16 (done)  |
| `usePointerDrag`, `useCompactLayout`, `useScrollSelectionIntoView`                                                                                                   | `src/shared/lib/react/`                                                                                    | GPW-16 (done)  |
| `SingleShotTimer`, `src/utils/{dom,events,sets,arrays,regexp,platform}.ts`                                                                                           | `src/shared/lib/`                                                                                          | GPW-16 (done)  |
| `src/utils/{Vector3D,Matrix4x4,Rect,Bounds3D,geometry,math}.ts` (the viewport's Qt-style render math)                                                                | `src/widgets/viewport/` with the viewport, its only user                                                   | GPW-34         |
| `src/utils/cn.ts`, `src/lib/utils.ts`                                                                                                                                | `src/shared/lib/cn.ts` (one version, with tailwind-merge)                                                  | GPW-17 (done)  |
| `src/core/viewport/glProgram.ts`                                                                                                                                     | `src/shared/lib/webgl/`                                                                                    | GPW-18 (done)  |
| `src/core/viewport/{VertexArray,lineQuads,shaders,panelLayout}.ts` (this viewport's vertex format, shaders and label layout)                                         | `src/widgets/viewport/`                                                                                    | GPW-34         |
| `src/hooks/useTheme.ts` (stores the app's theme choice)                                                                                                              | `src/app/`                                                                                                 | GPW-37         |
| `src/core/runtime`, `src/core/geometry`, `src/core/formats`                                                                                                          | `engine/runtime`, `engine/geometry`, `engine/formats`, each with an `index.ts`                             | GPW-19 (done)  |
| `src/utils/{cpp,cppStd}.ts`                                                                                                                                          | `engine/runtime/cpp/` (`what()` and number formatting are exported from `@engine/runtime`)                 | GPW-19 (done)  |
| `src/utils/{DVec3,dmat4}.ts`                                                                                                                                         | `engine/math/`                                                                                             | GPW-19 (done)  |
| `src/helpers/functions.ts` C++ parsing (function signatures, typed inputs)                                                                                           | `engine/runtime/analysis/sourceFunctions.ts`; the CodeMirror tree walks stay in `src/helpers/functions.ts` | GPW-20 (done)  |
| `engine/runtime/helpers/parameters.ts` source scanner                                                                                                                | `engine/runtime/analysis/parameterScan.ts`; the value conversions stay in `helpers/parameters.ts`          | GPW-20 (done)  |
| `engine/runtime/helpers/preprocessor.ts`                                                                                                                             | `engine/runtime/interpreter/preprocessor.ts`                                                               | GPW-20 (done)  |
| `src/utils/{DVec3,dmat4}.ts` (the engine's model math)                                                                                                               | `engine/math/` (moved in GPW-19); not merged with the render math, see the open decisions below            | GPW-21 (done)  |
| `src/helpers/{parameters,parameterTable}.ts`, `ParameterRow`/`ParameterEditor` from `src/types/panels.ts`; new `isFunctionParameterKey` and `parameterSlotCount`     | `src/entities/parameter/{lib,model}/`                                                                      | GPW-22 (done)  |
| `src/helpers/{traceFormatting,apiHistory,debugItems,debugValueText}.ts`, `src/hooks/apiTrace/{traceItems,historyItems,TraceTree}.ts`                                 | `src/entities/api-call/{lib,ui}/`                                                                          | GPW-23 (done)  |
| `src/helpers/variables.ts`, `VariableRow` from `src/types/panels.ts`                                                                                                 | `src/entities/variable/{lib,model}/`                                                                       | GPW-24 (done)  |
| `src/helpers/link.ts`                                                                                                                                                | `src/entities/connector/lib/`                                                                              | GPW-24 (done)  |
| `src/types/{linkForm,linkTable}.ts` (component props)                                                                                                                | with the Link feature and widget                                                                           | GPW-31, GPW-33 |
| `src/hooks/mainWindow/FunctionWorkspace.ts`, `src/helpers/functions.ts` (editor-side function parsing)                                                               | `src/entities/source-function/{model,lib}/`                                                                | GPW-25 (done)  |
| running the preview, the scene/result/feedback, preview mode and the per-tab Build cache (from `MainWindow`); Build/Debug buttons (from `App.tsx`)                   | `src/features/run-preview/` (`PreviewSession`, `PreviewModeToggle`)                                        | GPW-27 (done)  |
| `src/hooks/parameterPanel/ParameterPanelModel.ts`, `src/hooks/useParameterPanel.ts`, the table dialog from `ParameterPanel.tsx`                                      | `src/features/edit-parameters/{model,ui}/`                                                                 | GPW-29 (done)  |
| function tabs (from `MainWindow`)                                                                                                                                    | `src/features/manage-functions/`                                                                           | GPW-30         |
| Link panel model and form                                                                                                                                            | `src/features/edit-connector/`                                                                             | GPW-31         |
| OBJ import and export                                                                                                                                                | `src/features/model-files/`                                                                                | GPW-32         |
| panel components and their models                                                                                                                                    | `src/widgets/{parameter,variable,api-trace,link}-panel/`                                                   | GPW-33         |
| editor, viewport, header and menus                                                                                                                                   | `src/widgets/{code-editor,viewport,workspace-header}/`                                                     | GPW-34         |
| `src/components/App.tsx`, the rest of `MainWindow`                                                                                                                   | `src/pages/workspace/`                                                                                     | GPW-36         |
| `src/main.tsx`, `src/index.css`, global shortcuts                                                                                                                    | `src/app/`                                                                                                 | GPW-37         |

### Left in the old folders after P4

`src/lib/` is gone (GPW-17). Every remaining file in `src/types/`, `src/helpers/` and `src/utils/` belongs to a feature, widget or page that P5 and P6 create, so it moves with that ticket. GPW-37 deletes the empty folders.

| File                                                                                                                     | Moves to                    | Ticket         |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------- | -------------- |
| `src/types/panels.ts` (panel handle and props types)                                                                     | the panel widgets           | GPW-33         |
| `src/types/linkForm.ts`, `src/types/linkTable.ts`                                                                        | the Link feature and widget | GPW-31, GPW-33 |
| `src/types/modelFiles.ts`                                                                                                | `features/model-files`      | GPW-32         |
| `src/types/editor.ts`                                                                                                    | `widgets/code-editor`       | GPW-34         |
| `src/types/viewport.ts`, `src/types/viewportEngine.ts`, `src/helpers/viewportHandle.ts`, `src/helpers/viewportPoints.ts` | `widgets/viewport`          | GPW-34         |
| `src/utils/{Vector3D,Matrix4x4,Rect,Bounds3D,geometry,math}.ts`                                                          | `widgets/viewport`          | GPW-34         |
| `src/types/toolbar.ts`, `src/types/mainWindow.ts`                                                                        | `widgets/workspace-header`  | GPW-34         |
| `src/types/dockArea.ts`, `src/helpers/layout.ts` (dock list and height)                                                  | the dock shell              | GPW-35         |
| `src/types/statusBar.ts`                                                                                                 | `pages/workspace`           | GPW-36         |

## Open decisions

These look like duplicates but behave differently in edge cases. Merging them would change output for degenerate input, so each needs a decision (ideally checked against the desktop app) before it is unified.

- **Two math kits.** `engine/math` (`DVec3`, `dmat4`) is double-precision model math. The viewport's `QVector3D` and `QMatrix4x4` follow Qt's semantics and store `Float32Array`s. Merging them would change the numbers in either the geometry output or the renderer.
- **`rotateAroundAxis` (geometry) vs `FdVector3d.rotateBy` (runtime).** Same Rodrigues formula; for a zero-length axis the first returns the vector unchanged, the second scales it by `cos(angle)`.
- **`stableBasis` / `sdkPerpVector` (geometry) vs `perpVector` (runtime).** Same 0.85 helper axis; they differ in the fallback threshold (below 1e-12 vs exactly 0) and in how a zero input is handled.
- **"Default up" threshold.** 0.85 in `geometryMath.ts` and `pointVectorMembers.ts`, 0.9 in `NamedArguments.ts` and `intersectionAdapters.ts`, 0.5 in `ConnectorPreview.ts`. Changing any of them can move generated geometry.
