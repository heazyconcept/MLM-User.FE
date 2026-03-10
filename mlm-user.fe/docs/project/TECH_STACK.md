# Tech Stack

**What the stack can and can’t support.**

---

## 1. Core technologies

| Layer | Technology | Version (approx.) | Purpose |
|-------|------------|-------------------|---------|
| Framework | Angular | 21.x | SPA, routing, components, DI |
| Language | TypeScript | 5.9.x | Typing, tooling |
| Styling | Tailwind CSS | 4.x | Utility-first CSS, design tokens |
| UI components | PrimeNG | 21.x | Buttons, inputs, tables, dialogs, toast, etc. |
| PrimeNG theme | @primeuix/themes (Aura) | 2.x | Theming; overridden with brand primary |
| Icons | PrimeIcons | 7.x | Icon set |
| Charts | Chart.js | 4.x | Charts (e.g. dashboard, earnings) |
| HTTP | Angular HttpClient | (built-in) | API calls, interceptors |
| State / reactivity | Angular Signals + RxJS | Signals (Angular 21), RxJS 7.8 | Local and shared state, async streams |
| Build | Angular CLI (esbuild) | @angular/build 21.x | Dev server, production build |
| Testing | Vitest, jsdom | 4.x, 27.x | Unit tests |

---

## 2. What the stack supports

### 2.1 Frontend capabilities

- **Single-page application:** Full client-side routing, lazy-loaded feature modules (via `loadComponent`).
- **Responsive UI:** Tailwind breakpoints and PrimeNG responsive behavior; mobile-friendly layouts.
- **Theming:** Tailwind theme extension + CSS variables; PrimeNG Aura preset with custom primary; dark mode via `.dark` selector.
- **Forms:** Reactive forms, validation, PrimeNG form controls (input, select, checkbox, etc.).
- **HTTP:** REST-style API calls, interceptors for auth, loading, and error handling.
- **State:** Signals for synchronous state; RxJS Observables for async (HTTP, timers); TanStack Query for server state (API GETs cached; mutations invalidate). No NgRx/global store in current setup.
- **Accessibility:** PrimeNG ARIA support; project requirement to pass AXE and WCAG AA with semantic HTML and focus management.
- **i18n:** Angular i18n available; not yet configured (no locale switching in current scope).
- **Testing:** Vitest + jsdom for unit tests; no E2E framework listed in package.json.

### 2.2 Development experience

- **Standalone components:** Default in Angular 21; no NgModules required.
- **Modern Angular APIs:** Signals, `input()`/`output()`, native control flow (`@if`, `@for`, `@switch`), `inject()`.
- **Hot reload:** `ng serve` with fast refresh.
- **Linting/formatting:** Prettier (e.g. 100 print width, single quotes; HTML overrides for Angular).

---

## 3. What the stack does not support (or limits)

### 3.1 Backend and infra

- **No backend:** App is UI-first; all data is mocked or persisted in localStorage. Real auth, wallets, orders, notifications require a backend and API integration.
- **No server-side rendering (SSR):** Angular is used in client-only mode. SEO or first-load performance via SSR would require Angular SSR/SSG setup (not in current stack).
- **No PWA/offline:** No service worker or offline caching in the default setup; would need Angular PWA or custom worker.

### 3.2 State and data

- **No built-in global store:** No NgRx, Akita, or similar. Complex cross-feature state is handled by services + signals/Observables. For very large apps, a store could be added later.
- **No real-time transport:** No WebSocket or SSE in the stack by default; real-time notifications would need a library and backend support.
- **No offline-first DB:** No IndexedDB abstraction (e.g. Dexie) or local DB; persistence is localStorage and in-memory mocks.

### 3.3 UI and design

- **No design tool sync:** Design tokens are maintained in code (Tailwind + CSS); no automatic sync with Figma/Sketch.
- **PrimeNG constraints:** UI patterns follow PrimeNG components; heavy customization may require Pass Through (PT) or custom components.
- **Chart.js only:** No other chart library in use; advanced visualizations may need additional libs or custom SVG/Canvas.

### 3.4 Auth and security

- **Client-side auth only:** Tokens and “logged-in” state are in localStorage and interceptors; no backend session or token refresh flow yet. Production needs secure token handling and refresh.
- **No built-in 2FA UI:** Specs mention 2FA in settings; implementation would be custom or via PrimeNG + backend.
- **CORS and API origin:** Backend must allow frontend origin; stack does not remove need for proper CORS and API security.

### 3.5 Testing and quality

- **No E2E in package.json:** No Cypress, Playwright, or Protractor listed; E2E would require adding one.
- **No visual regression:** No Percy, Chromatic, or similar; visual changes are manual or via screenshots.
- **No strict CSP:** Content Security Policy not defined in the app; may be required by hosting.

### 3.6 Performance and scale

- **Bundle size:** PrimeNG and Chart.js add weight; tree-shaking and lazy loading help. Very tight budgets may require auditing and optional lazy loading of charts.
- **Large lists:** PrimeNG Table supports virtual scroll for large data; custom lists may need virtualization (e.g. CDK) if not provided by PrimeNG.
- **No CDN or edge:** Static assets are served by Angular dev/build output; CDN/edge caching is an infrastructure choice, not in the frontend stack.

---

## 4. Dependency summary

- **Angular 21:** Core, common, compiler, forms, platform-browser, router; build and CLI 21.x.
- **PrimeNG 21 + PrimeIcons + @primeuix/themes:** Full UI and theming.
- **Tailwind 4 + @tailwindcss/postcss + tailwindcss-primeui:** Styling and PrimeNG/Tailwind integration.
- **Chart.js:** Charts.
- **RxJS 7.8:** Async and HTTP.
- **Vitest + jsdom:** Unit testing.
- **Prettier:** Formatting (config in package.json).

---

## 5. Upgrade and compatibility

- **Angular:** Follow Angular release cycle; check breaking changes (e.g. 21 → 22).
- **PrimeNG:** Align with Angular version; check PrimeNG changelog for breaking changes and migration (e.g. v20 → v21).
- **Tailwind 4:** Different from v3 (e.g. `@theme`, PostCSS setup); stay on v4 unless migration is planned.
- **Node/npm:** Use Node and npm versions compatible with Angular 21 and the build toolchain (see project or Angular docs).

---

## 6. Summary

| Need | Supported? | Notes |
|------|------------|--------|
| SPA with routing | Yes | Lazy loading, guards |
| Responsive, accessible UI | Yes | Tailwind + PrimeNG + WCAG |
| Theming / dark mode | Yes | Tailwind + PrimeNG preset |
| Forms and validation | Yes | Reactive forms + PrimeNG |
| HTTP + interceptors | Yes | Auth, loading, error |
| Client-side state | Yes | Signals + services + RxJS |
| Real backend integration | Not yet | Replace mocks with API |
| SSR / SEO | No | Not in current stack |
| PWA / offline | No | Not in current stack |
| Real-time (WebSocket) | No | Not in current stack |
| E2E tests | No | Add if required |
| Global store (e.g. NgRx) | No | Add if complexity demands |
