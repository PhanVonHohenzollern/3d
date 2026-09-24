# Geometry Preview (web)

React + TypeScript port of the Qt/C++ Geometry Preview desktop app in the parent
directory. The C++ subset interpreter, SDK metadata, preview geometry, 3D viewport
(WebGL2) and all panels run entirely in the browser. There is no backend.

```sh
nvm use           # Node.js version used by CI
npm ci
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm test           # unit + differential tests (needs a C++20 compiler, see below)
npm run typecheck
npm run validate  # ESLint, Prettier, TypeScript, standalone tests
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

## Continuous integration and GitHub Pages

The [GitHub Actions workflow](.github/workflows/ci.yml) runs on pull requests and
pushes to `main`, and can also be started manually from the Actions tab. It has
three sequential jobs: **Validate → Build → Deploy**. Each job runs only after
the previous job succeeds.

1. **Validate** installs dependencies with `npm ci` and runs ESLint (zero warnings),
   Prettier, TypeScript, and the standalone UI/renderer tests.
2. **Build** installs dependencies in a fresh runner, produces the production
   build, and uploads the Pages artifact for `main`.
3. **Deploy** publishes that artifact to <https://kienmai160598.github.io/3d/>.

Pull requests run Validate and Build; Deploy runs only for `main` outside pull requests.

GitHub Pages must be enabled under **Settings → Pages → Source → GitHub Actions**.
Deployment uses the built-in `GITHUB_TOKEN`; no personal token or deploy secret is
needed. The deploy job alone receives Pages write and OIDC permissions. Action
versions are pinned to commit SHAs, and deployments are serialized.

The workflow passes `--base /3d/` to Vite (derived from the repository name) so
assets load under the Pages project path. To test that production build locally:

```sh
npm run build -- --base /3d/
npm run preview -- --base /3d/    # open http://localhost:4173/3d/
```

Use `npm run lint:fix` and `npm run format` to fix lint/format issues before pushing.
Generated SDK registries are excluded from ESLint and Prettier but remain included
in TypeScript checking and the build. TypeScript is pinned to the 6.0 release line,
which is supported by the ESLint TypeScript parser.

`npm run test:ci` runs the standalone suites in `tests/ui` and `tests/renderer`.
The full `npm test` command also runs differential tests requiring the original
C++ sources in the parent directory; those sources are not in this repository and
are therefore unavailable in GitHub Actions. CI does not claim C++ parity coverage.
