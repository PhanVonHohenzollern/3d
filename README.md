# Geometry Preview

Write C++ geometry code against the FLM3Geo SDK and see the result in a live 3D preview. The app interprets the code up to the cursor line and draws the geometry it produces. It also shows variables, the API call trace and parameters. Everything runs in the browser; there is no backend.

Live version: <https://kienmai160598.github.io/3d/>

## Run locally

Requires Node.js 24 (see `.nvmrc`) and npm.

```sh
nvm use
make install   # or: npm ci
make dev       # or: npm run dev
```

Then open <http://localhost:5173>.

Run `make` to list the other commands: build, test, lint, format and validate.

More detail: [docs/](docs/) describes the app's behavior, and [CLAUDE.md](CLAUDE.md) covers the architecture and development conventions.
