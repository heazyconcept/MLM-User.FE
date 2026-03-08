# Frontend Guidelines

**How components are engineered, state management, and file structure.**

---

## 1. Component engineering

### 1.1 Angular and TypeScript

- **Standalone components only** — no NgModules. Do not set `standalone: true` in decorators (default in Angular 21).
- **Signals for state** — use `signal()`, `computed()`, and `effect()` where appropriate. Prefer `update()` or `set()` on signals; avoid `mutate`.
- **Strict typing** — no `any`; use `unknown` when type is uncertain. Rely on type inference when obvious.
- **`input()` and `output()`** — use the new input/output functions instead of `@Input()` and `@Output()`.
- **Change detection** — set `changeDetection: ChangeDetectionStrategy.OnPush` on components.
- **Host bindings** — use the `host` object in `@Component` / `@Directive`; do not use `@HostBinding` or `@HostListener`.

### 1.2 Templates and control flow

- Use **native control flow**: `@if`, `@for`, `@switch` instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
- Prefer **inline templates** for small components; external templates use paths **relative to the component TS file**.
- No **arrow functions in templates** (not supported). No reliance on globals (e.g. `new Date()`) without providing them from the component.
- Use **`class`** and **`style`** bindings instead of `ngClass` and `ngStyle`.

### 1.3 Forms and accessibility

- Prefer **reactive forms** over template-driven forms.
- **Accessibility:** Pass AXE checks and meet **WCAG AA** (focus, contrast, ARIA). Labels on all inputs; keyboard navigation supported.
- **Images:** Use `NgOptimizedImage` for static images (not for inline base64).

### 1.4 Styling

- **Tailwind CSS only** for styling. No hardcoded colors; use the palette from `tailwind.config.js` and `styles.css`.
- **Icons:** PrimeIcons or Font Awesome only.
- Components should be **responsive and mobile-friendly** by default.

---

## 2. State management

### 2.1 Local state

- **Signals** for component state; **computed()** for derived state.
- Keep transformations **pure and predictable**; avoid side effects inside computed.

### 2.2 Global / shared state

- **Singleton services** with `providedIn: 'root'`.
- Services use **signals** for shared state (e.g. `AuthService.isAuthenticated`, `WalletService` wallets/transactions).
- **RxJS** for async streams (HTTP, timers); expose Observables and use **async pipe** in templates where appropriate.
- **No global store** (e.g. NgRx) in current stack; feature-specific services hold domain state.

### 2.3 Persistence (mock/current)

- Auth: token and auth state in **localStorage** (e.g. `mlm_auth_token`).
- User/profile and payment status: persisted via **UserService** (localStorage).
- Wallets, transactions, withdrawals: **WalletService** with localStorage keys (e.g. `mlm_wallets`, `mlm_withdrawal_history`).
- When backend exists: replace mock persistence with API calls; keep service interfaces stable.

---

## 3. Services

- **Single responsibility** per service (e.g. `AuthService`, `WalletService`, `OrderService`, `NotificationService`).
- **Dependency injection:** use `inject()` instead of constructor injection.
- **HTTP:** use `HttpClient` with interceptors (auth, loading, error). See `core/interceptors/`.

---

## 4. File structure

```
mlm-user.fe/src/
├── app/
│   ├── app.ts, app.html, app.css, app.config.ts, app.routes.ts
│   ├── auth/                    # Auth feature (login, register, forgot-password, reset-password, verify)
│   ├── core/                     # Interceptors, guards, app-wide singletons
│   │   └── interceptors/         # auth.interceptor, error.interceptor, loading.interceptor
│   ├── layouts/
│   │   ├── dashboard-layout/     # Main app shell (sidebar + outlet)
│   │   └── onboarding-layout/    # Onboarding flow shell
│   ├── pages/                    # Route-level page components
│   │   ├── dashboard/
│   │   ├── profile/
│   │   ├── shop/                 # Marketplace, product detail
│   │   ├── wallet/               # Wallet, transactions, withdrawals
│   │   ├── network/              # Overview, referrals, matrix, downline, performance
│   │   ├── commissions/          # Earnings, breakdown, bonuses, ranking, CPV
│   │   ├── transactions/
│   │   ├── orders/               # Orders overview, preview, detail
│   │   ├── notifications/        # List, preferences
│   │   ├── settings/             # Account, security, preferences, sessions
│   │   └── merchant/             # Merchant dashboard, inventory, orders, deliveries, earnings
│   ├── components/               # Shared UI components
│   │   ├── badge, copy-button, filter-bar, loading, modal, order-card,
│   │   ├── side-menu, stat-card, status-badge, inventory-row, location-selector,
│   │   ├── order-timeline, product-gallery, quantity-selector, dashboard-header, etc.
│   └── services/                 # Injectable services
│       ├── auth.service, user.service, wallet.service, order.service,
│       ├── product.service, commission.service, notification.service,
│       ├── merchant.service, transaction.service, layout.service, modal.service
├── environments/                 # environment.ts, environment.development.ts
├── index.html
├── main.ts
└── styles.css                    # Global styles, Tailwind, PrimeNG, design tokens
```

### 4.1 Naming conventions

- **Files:** kebab-case (e.g. `dashboard-layout.component.ts`, `wallet.service.ts`).
- **Components:** PascalCase class names; selector prefix `app-` (e.g. `App`, `DashboardLayoutComponent`).
- **Routes:** defined in `app.routes.ts`; lazy-loaded via `loadComponent` with path relative to app.

### 4.2 Route vs feature organization

- **pages/** = one folder per route area (dashboard, wallet, network, etc.); may contain sub-routes and child components.
- **components/** = reusable, shared across pages.
- **layouts/** = shells that wrap outlets (dashboard with sidebar, onboarding steps).

---

## 5. HTTP and interceptors

- **Auth interceptor:** attach token (or mock token) to outgoing requests.
- **Loading interceptor:** global loading state (e.g. full-page or bar) during HTTP calls.
- **Error interceptor:** centralize error handling and user feedback (e.g. toast, redirect to login).

Use `provideHttpClient(withInterceptors([...]))` in `app.config.ts`.

---

## 6. Reusable components (existing)

- **UI:** Badge, CopyButton, FilterBar, Loading, Modal, OrderCard, SideMenu, StatCard, StatusBadge, DashboardHeader.
- **Domain:** InventoryRow, LocationSelector, OrderTimeline, ProductGallery, QuantitySelector, ProductCard, etc.

Prefer **reusing** these over duplicating markup and behavior. New shared UI should go in `components/` with a single, clear responsibility.

---

## 7. Quality and consistency

- **Small, focused components** — one main responsibility per component.
- **Consistent naming** for files, classes, and symbols.
- **Readable code** with comments where logic is non-obvious.
- **Scalable structure** so new features (e.g. new sidebar section) fit existing patterns (new page under `pages/`, optional shared component, service if needed).

Reference: `mlm-user.fe/best-practices.md` for TypeScript, Angular, accessibility, and styling details.
