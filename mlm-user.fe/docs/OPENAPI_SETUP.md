# OpenAPI type generation

Types are generated from the backend OpenAPI spec so the frontend stays in sync with the API.

## Prerequisites

- `openapi-typescript` is installed as a dev dependency.

## Commands

From the `mlm-user.fe` folder:

| Script | Description |
|--------|-------------|
| `npm run openapi:generate` | Fetches the spec from the live API (`https://segulah-api.onrender.com/api/docs-json`) and writes TypeScript types to `src/app/core/api-types.ts`. |
| `npm run openapi:generate:local` | Uses a local `docs/openapi.json` file (e.g. after running the API and `npm run openapi:dump` on the backend). Use when the API is not reachable or you want to work offline. |

## Usage

1. Run once (or when the API contract changes):
   ```bash
   npm run openapi:generate
   ```
2. Import types in services/components from `@app/core/api-types` (or the path you use for `src/app/core`), e.g.:
   ```ts
   import type { components } from '../core/api-types';
   type AuthResponse = components['schemas']['AuthResponse'];
   ```
3. Optionally refactor existing hand-written interfaces to use the generated types.

## Local spec file

If the backend repo has `npm run openapi:dump`, run the API locally, run that script to create `docs/openapi.json`, copy that file into `mlm-user.fe/docs/openapi.json`, then run `npm run openapi:generate:local`.
