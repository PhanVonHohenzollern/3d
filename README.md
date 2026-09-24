# Geometry Preview

Geometry Preview runs entirely in the browser: you edit C++ geometry code and see the SDK geometry it produces in a live 3D preview. This is a React port of the original Qt/C++ desktop app. The C++ subset interpreter, the SDK metadata, the preview geometry, the WebGL2 viewport and all panels run client-side; there is no backend.

Stack: React 19, TypeScript 6, Vite, Tailwind CSS 4, CodeMirror 6, raw WebGL2, Vitest, ESLint and Prettier.

```sh
nvm use                # Node.js version used by CI (.nvmrc)
npm ci
npm run dev            # http://localhost:5173
npm run build          # static site in dist/
npm test               # all tests
npm run lint           # ESLint
npm run format         # Prettier (with Tailwind class sorting)
npm run typecheck
npm run validate       # ESLint, Prettier, TypeScript and all tests, as in CI
```

## Behavior

User-visible behavior is specified in [docs/BEHAVIOR.md](docs/BEHAVIOR.md), [docs/API_TRACE.md](docs/API_TRACE.md) and [docs/BUILTIN_CONSTANTS.md](docs/BUILTIN_CONSTANTS.md).

The fixture tests lock in that behavior. Each C++ snippet in `tests/fixtures/` has an `*.expected.json.gz` file next to it. That file holds every observable output: variables and their history, diagnostics, API calls with argument provenance, overload resolution, parameter roles, debug anchors, every mesh vertex, warnings, Link connector previews and evaluated expressions. The expected outputs were captured from the original C++ implementation. After an intentional behavior change, regenerate them with `npm run update-expected`; to regenerate only some fixtures, set `FIXTURE=<name part>` in front of the command. Review the diff before committing.

Differences from the desktop app:

- WebGL cannot draw lines wider than 1 px. Wide lines are drawn as screen-space quads instead.
- Docks are fixed bottom tabs. They cannot float or close.
- If a pathologically nested expression exhausts the JavaScript stack, the preview keeps its previous state and the status bar shows the error.
- File > Exit calls `window.close()`, which browsers usually ignore.

## Continuous integration and GitHub Pages

The [GitHub Actions workflow](.github/workflows/ci.yml) runs on pull requests and pushes to `main`. You can also start it manually from the Actions tab. It has three sequential jobs, **Validate → Build → Deploy**, and each runs only after the previous one succeeds. `ci.yml` calls three reusable workflow templates with job-level `uses`: [validate.yml](.github/workflows/validate.yml), [build.yml](.github/workflows/build.yml) and [deploy.yml](.github/workflows/deploy.yml). Each template exposes `workflow_call`; triggers and stage dependencies stay in `ci.yml`.

1. **Validate** installs dependencies with `npm ci`. It then runs ESLint (zero warnings), Prettier, TypeScript and the full test suite (`npm run test:ci`), including the fixture behavior tests against the committed expected outputs.
2. **Build** installs dependencies in a fresh runner, produces the production build and uploads the Pages artifact for every successful build.
3. **Deploy** publishes that artifact to <https://kienmai160598.github.io/3d/>.

Pull requests run Validate and Build. Deploy runs only for `main` outside pull requests. The deployment condition lives only in `ci.yml`; the reusable templates do not decide which branches can deploy. Uploading an artifact does not publish it to Pages.

GitHub Pages must be enabled under **Settings → Pages → Source → GitHub Actions**. Deployment uses the built-in `GITHUB_TOKEN`; no personal token or deploy secret is needed. Only the deploy job receives Pages write and OIDC permissions. Action versions use explicit release tags, and deployments are serialized.

The workflow passes `--base /3d/` to Vite (derived from the repository name) so assets load under the Pages project path. To test that production build locally:

```sh
npm run build -- --base /3d/
npm run preview -- --base /3d/    # open http://localhost:4173/3d/
```

Use `npm run lint:fix` and `npm run format` to fix lint and format issues before pushing. The generated SDK registries are excluded from ESLint and Prettier but are still type-checked and built. TypeScript is pinned to the 6.0 release line, which the ESLint TypeScript parser supports.
