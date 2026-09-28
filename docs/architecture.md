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

1. **Every import starts with `@`.** Import project code through its alias: `@/…` for `src/`, `@tests/…` for `tests/`, and `@engine/…` for `engine/` once it exists (GPW-19). This applies to files in the same folder too. Relative (`./`, `../`) and absolute (`src/…`, `/…`) imports fail `npm run lint`.
2. **Public API only.** Every slice (`features/run-preview`, `entities/parameter`, …) and every engine package has an `index.ts`. From outside the slice, import that file, never a file inside it: `@/entities/parameter`, not `@/entities/parameter/model/key`.
3. **No imports between slices on the same layer.** One feature does not import another feature, and one widget does not import another widget. Composition happens one layer up: the page places both widgets. If two entities really need each other, use an FSD `@x` file (`entities/api-call/@x/variable.ts`) so the dependency is explicit, and add an `except` entry for it in `eslint.boundaries.config.js`.
4. **Engine through its packages.** App code imports `@engine/runtime`, `@engine/geometry`, `@engine/formats` or `@engine/math`, never a deeper path.

### How the rules are checked

| Rule                                                                                                     | Checked by                                                                                  | Mode now |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| Every import starts with `@` (rule 1)                                                                    | `npm run lint` (`no-restricted-imports` in `eslint.config.js`)                              | error    |
| Layer direction, public API, no cross-slice imports, engine independence (rules 2–4 and the table above) | `npm run lint:boundaries` (`import-x/no-restricted-paths` in `eslint.boundaries.config.js`) | warning  |
| No import cycles                                                                                         | `npm run lint:boundaries` (`import-x/no-cycle`)                                             | warning  |
| Folder structure inside a slice (segment names, an `index.ts` per slice)                                 | code review                                                                                 | —        |

`lint:boundaries` reads the slice folders on every run, so a new slice is checked as soon as it exists. It runs in `npm run validate` and in CI but only warns during the migration; GPW-38 turns it into errors. It is a separate config so `npm run lint` keeps allowing zero warnings.

`no-cycle` only sees runtime imports: it skips `import type`. The four cycles known at the start of the migration all go through a type-only import, so they are not reported. GPW-15 and GPW-45 remove them.

At the start of the migration (branch `chore/p1-guardrails`), `lint:boundaries` reported 10 warnings and no cycles:

- 6 are the viewport importing app helpers (`qtInput`, `debugItems`, `debugValueText`).
- 4 are `types/` importing from `hooks/` (`Action`, `TreeWidget`, `TreeWidgetItem`).
- The engine already imports nothing from app code.

After P2 (`shared/` layer): 3 warnings, all the viewport importing the API-call helpers that move to `entities/api-call` in GPW-23. `shared/` imports no app code, and `lint:boundaries` now warns if it does.

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

| Old                                                                                                                                                                  | New                                                                                                                      | Ticket        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `src/components/ui/*` (shadcn primitives, `ComboBox`, `FormLabel`, `LineEdit`, `PushButton`, `ToolButton`)                                                           | `src/shared/ui/`                                                                                                         | GPW-15 (done) |
| `EditableComboBox`, `FloatingWindow`, `TableView`, `PanelHeader`, `Splitter` + `ResizeHandle`, `PaginationControls`, `TreeView`, with their hooks, types and helpers | `src/shared/ui/{editable-combo-box,floating-window,table-view,panel-header,splitter,pagination,tree}/`                   | GPW-15 (done) |
| `src/helpers/layout.ts` splitter, floating-window and tree parts                                                                                                     | `src/shared/ui/{splitter,floating-window,tree}/`; the dock parts stay in `src/helpers/layout.ts`                         | GPW-15 (done) |
| `src/hooks/treeWidget/{TreeWidget,TreeWidgetItem}.ts`, `src/types/treeView.ts`                                                                                       | `src/shared/ui/tree/`                                                                                                    | GPW-15 (done) |
| `src/hooks/observable/*`, `useObservable`, `Signal`                                                                                                                  | `src/shared/lib/observable/`                                                                                             | GPW-16 (done) |
| `Action`, `useAction`                                                                                                                                                | `src/shared/lib/action/`                                                                                                 | GPW-16 (done) |
| `src/types/{qt,input}.ts`, `src/helpers/{qtInput,keyboard}.ts`                                                                                                       | `src/shared/lib/qt/`                                                                                                     | GPW-16 (done) |
| `src/utils/{textMetrics,CanvasTextMeasurer,measureText}.ts`, `src/types/text.ts`                                                                                     | `src/shared/lib/text/`                                                                                                   | GPW-16 (done) |
| `src/utils/painting.ts`, `src/types/painting.ts`                                                                                                                     | `src/shared/lib/painting/`                                                                                               | GPW-16 (done) |
| `usePointerDrag`, `useCompactLayout`, `useScrollSelectionIntoView`                                                                                                   | `src/shared/lib/react/`                                                                                                  | GPW-16 (done) |
| `SingleShotTimer`, `src/utils/{dom,events,sets,arrays,regexp,platform}.ts`                                                                                           | `src/shared/lib/`                                                                                                        | GPW-16 (done) |
| `src/utils/{math,Rect,Bounds3D,geometry}.ts`                                                                                                                         | stay in `src/utils/` until GPW-21 decides the math home (`math.ts` is needed by `Vector3D`, which becomes `engine/math`) | GPW-21        |
| `src/utils/cn.ts`, `src/lib/utils.ts`                                                                                                                                | `src/shared/lib/cn.ts` (one version, with tailwind-merge)                                                                | GPW-17 (done) |
| `src/core/viewport/glProgram.ts`                                                                                                                                     | `src/shared/lib/webgl/`                                                                                                  | GPW-18 (done) |
| `src/core/viewport/{VertexArray,lineQuads,shaders,panelLayout}.ts` (this viewport's vertex format, shaders and label layout)                                         | `src/widgets/viewport/`                                                                                                  | GPW-34        |
| `src/hooks/useTheme.ts` (stores the app's theme choice)                                                                                                              | `src/app/`                                                                                                               | GPW-37        |
| `src/core/runtime`, `src/core/geometry`, `src/core/formats`, `src/utils/{cpp,cppStd,DVec3,dmat4}.ts`                                                                 | `engine/runtime`, `engine/geometry`, `engine/formats`                                                                    | GPW-19        |
| `src/helpers/functions.ts` (C++ parsing part), runtime source scanners                                                                                               | `engine/runtime/analysis/`                                                                                               | GPW-20        |
| `src/utils/{DVec3,Vector3D,Matrix4x4,dmat4}.ts`                                                                                                                      | `engine/math/`                                                                                                           | GPW-21        |
| parameter types and helpers                                                                                                                                          | `src/entities/parameter/`                                                                                                | GPW-22        |
| trace and history formatting, debug item ids                                                                                                                         | `src/entities/api-call/`                                                                                                 | GPW-23        |
| `src/helpers/{variables,link}.ts`, link types                                                                                                                        | `src/entities/variable/`, `src/entities/connector/`                                                                      | GPW-24        |
| `src/hooks/mainWindow/FunctionWorkspace.ts`                                                                                                                          | `src/entities/source-function/`                                                                                          | GPW-25        |
| running the preview and the build cache (from `MainWindow`)                                                                                                          | `src/features/run-preview/`                                                                                              | GPW-27        |
| parameter editing                                                                                                                                                    | `src/features/edit-parameters/`                                                                                          | GPW-29        |
| function tabs (from `MainWindow`)                                                                                                                                    | `src/features/manage-functions/`                                                                                         | GPW-30        |
| Link panel model and form                                                                                                                                            | `src/features/edit-connector/`                                                                                           | GPW-31        |
| OBJ import and export                                                                                                                                                | `src/features/model-files/`                                                                                              | GPW-32        |
| panel components and their models                                                                                                                                    | `src/widgets/{parameter,variable,api-trace,link}-panel/`                                                                 | GPW-33        |
| editor, viewport, header and menus                                                                                                                                   | `src/widgets/{code-editor,viewport,workspace-header}/`                                                                   | GPW-34        |
| `src/components/App.tsx`, the rest of `MainWindow`                                                                                                                   | `src/pages/workspace/`                                                                                                   | GPW-36        |
| `src/main.tsx`, `src/index.css`, global shortcuts                                                                                                                    | `src/app/`                                                                                                               | GPW-37        |
