# AGENTS.md

## Project Location

All source code is inside `mlm-user.fe/`. Run commands from there.

## Dev Commands

```bash
cd mlm-user.fe
npm run start    # ng serve
npm run build    # ng build
npm run test     # Vitest (ng test)
```

No separate lint or typecheck scripts exist.

## Tech Stack

- **Angular 21** (standalone components by default — no `standalone: true` needed)
- **PrimeNG 21**, **Tailwind CSS 4**, **PrimeIcons 7**
- **Signals** for state, **RxJS** for async
- **Vitest + jsdom** for unit tests
- **Prettier** (100 chars, single quotes; HTML uses Angular parser)
- **No NgModules** — use standalone components only

## Key Architecture

- **Routes**: All lazy-loaded via `loadComponent` in `app.routes.ts`
- **Layouts**: `dashboard-layout/` wraps main app shell (sidebar + outlet); `onboarding-layout/` for onboarding flow
- **Auth routes**: Under `/auth/*` (login, register, activation, payment-callback, etc.)
- **Services**: `src/app/services/` — singleton services with `providedIn: 'root'`
- **Interceptors**: `src/app/core/interceptors/` — auth, error, loading
- **Components**: Shared UI in `src/app/components/`

## Templates & Styling

- Use **native control flow**: `@if`, `@for`, `@switch` (not `*ngIf`, `*ngFor`)
- Use `input()` / `output()` functions (not `@Input()` / `@Output()`)
- Use `inject()` (not constructor injection)
- Use `class` / `style` bindings (not `ngClass` / `ngStyle`)
- **Tailwind only** for styling; no hardcoded colors
- **OnPush** change detection by default

## API Configuration

- API URL in `src/environments/environment.ts` (production) and `environment.development.ts`
- Current default: `https://api.segulah.ng`
- For local development: edit environment files or use ngrok and update `allowedHosts` in `angular.json`

## Common Pitfalls

- **Arrow functions in templates** are not supported — define methods in the component
- **`GET /wallets` returns 403 for unactivated users** — check `isPaid()` before calling
- **Redirect after wallet funding** sends users to `/wallet` — they must navigate back to activation manually
- **Components with inline templates**: template is in the same file after `template: \``...`\``
- **Components with external templates**: path is relative to the component TS file

## Available Skills

- `.agent/skills/ui/SKILL.md` — distinctive UI design guidance
- `.agent/skills/react-to-angular/SKILL.md` — React-to-Angular conversion reference table

## Documentation

- `mlm-user.fe/DEVELOPER_ONBOARDING.md` — project scope, feature status, registration flow
- `mlm-user.fe/docs/project/TECH_STACK.md` — full tech stack details
- `mlm-user.fe/docs/project/FRONTEND_GUIDELINES.md` — component engineering, state, file structure
- `mlm-user.fe/docs/REGISTRATION_ACTIVATION_E2E_TEST.md` — E2E test cases
