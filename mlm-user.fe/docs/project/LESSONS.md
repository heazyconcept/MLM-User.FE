# Lessons Learned

**Design mistakes, patterns, and corrections from previous sessions.**

This document captures recurring lessons so future work avoids the same pitfalls. Update it as new patterns or corrections emerge.

---

## 1. Design and UX

### 1.1 Color and tokens

- **Don’t hardcode colors.** Use Tailwind tokens from `tailwind.config.js` and `styles.css` (e.g. `mlm-primary`, `mlm-warm-700`). Hardcoded hex in components breaks theming and consistency.
- **Keep PrimeNG in sync with brand.** The Aura preset in `app.config.ts` overrides the primary palette to match `#49A321`. If the brand primary changes, update both Tailwind/theme and the PrimeNG preset.
- **Semantic colors for state.** Use `mlm-success`, `mlm-error`, `mlm-warning` for status (e.g. badges, alerts), not arbitrary colors.

### 1.2 Typography and spacing

- **One body font.** Geist is the default; avoid mixing many fonts. Use Outfit/Poppins only where design explicitly calls for variety.
- **Consistent spacing.** Use Tailwind spacing scale (e.g. `p-4`, `gap-4`, `space-y-4`) instead of one-off values. Align card and section spacing across pages.

### 1.3 Empty and loading states

- **Always handle empty data.** Dashboard, wallet, network, orders, notifications should show clear empty states with CTAs (e.g. “Invite Friends”, “Browse Products”), not blank or broken layouts.
- **Skeletons before content.** Per dashboard spec: load skeletons first, then data. Avoid layout shift and “flash of empty” for lists and cards.
- **Loading on buttons.** Buttons that trigger async actions (login, submit, withdraw) must show loading state and be disabled during the request to prevent double submit.

---

## 2. Component and code patterns

### 2.1 Angular and TypeScript

- **No `any`.** Use strict types; use `unknown` and narrow if type is uncertain. Loose typing caused bugs and made refactors risky.
- **Signals over manual subscription where possible.** Prefer `signal()` + `computed()` for local and shared state; use RxJS for HTTP and true async streams. Avoid mixing both in the same component without a clear split.
- **Don’t mutate signals.** Use `set()` or `update()`; avoid `mutate()` to keep state predictable and avoid subtle bugs.
- **Host bindings in `host`.** Do not use `@HostBinding`/`@HostListener`; use the `host` object in the component/directive decorator (Angular best practice in current version).
- **Native control flow.** Use `@if`, `@for`, `@switch` instead of `*ngIf`, `*ngFor`, `*ngSwitch` for clarity and performance.
- **No arrow functions in templates.** They are not supported; use component methods or computed values instead.

### 2.2 Forms and validation

- **Reactive forms preferred.** Template-driven forms are harder to test and validate consistently. Use ReactiveFormsModule and FormBuilder.
- **Inline errors.** Show validation errors near the field (e.g. below input), not only in a summary. Improves accessibility and clarity.
- **Validate before submit.** Disable submit until form is valid, or show errors on submit; avoid sending invalid data even in mock flows.

### 2.3 Accessibility

- **Labels for every input.** Use proper `<label>` or `aria-label` so screen readers and AXE pass. Placeholder is not a label.
- **Focus and keyboard.** Ensure logical tab order and visible focus (e.g. focus ring). Modals and drawers must trap focus and return focus on close.
- **Contrast.** Use semantic text colors (e.g. `mlm-warm-700` on light backgrounds) so contrast meets WCAG AA. Check status badges and small text.

### 2.4 Styling

- **Tailwind only.** No ad-hoc CSS or inline styles for layout/colors; use Tailwind classes. Exceptions: design tokens in `styles.css`, PrimeNG overrides via PT or theme.
- **No `ngClass` / `ngStyle`.** Use `[class.x]` and `[style.x]` bindings. Cleaner and easier to reason about.
- **Reuse components.** Prefer shared components (e.g. StatCard, Badge, CopyButton) over copying markup. Reduces drift and inconsistency.

---

## 3. State and data

### 3.1 Auth and persistence

- **Restore auth on load.** Auth state (e.g. token in localStorage) should be read on app init so refresh doesn’t log the user out. `AuthService` and `UserService` already persist; keep this pattern.
- **Single source of truth for user.** User and payment/onboarding status should live in one place (e.g. UserService); components read from there instead of duplicating state.
- **Logout clears everything that should be cleared.** Clear token and any user-sensitive cache; redirect to login. Don’t leave stale data that looks “logged in.”

### 3.2 Mock vs backend

- **Mock structure = API shape.** When mocking, use DTOs/interfaces that match the expected API response so swapping to real HTTP is a small step.
- **Loading and error in every async path.** Even mocks should simulate delay and failure so UI handles loading and error states; avoids surprises when backend is connected.
- **Don’t over-mock.** Mock only what the UI needs for the current flow; avoid building a full fake backend in the frontend.

---

## 4. Routing and navigation

- **Lazy load feature routes.** Use `loadComponent` in `app.routes.ts` for auth, dashboard, wallet, network, etc., to keep initial bundle small.
- **Breadcrumbs/titles.** Use route `data: { title }` for breadcrumbs or page title; keeps navigation context clear.
- **Redirects.** Document and implement redirects (e.g. `''` → login, `network` → `network/overview`, `settings` → `settings/account`) so direct URL entry and links behave consistently.

---

## 5. Performance and structure

- **Lazy load heavy libs.** Chart.js and large PrimeNG modules can be loaded only on routes that need them if bundle size becomes an issue.
- **Small components.** Large components (long template, many responsibilities) are hard to test and change. Split into presentational and container/smart components where it helps.
- **Services by feature.** One service per bounded context (auth, wallet, orders, notifications) avoids “god services” and makes backend replacement easier.

---

## 6. Common mistakes to avoid

- Assuming “it’s mock so it doesn’t matter” — validation, loading, and error handling still matter for UX and for the day you plug in the API.
- Forgetting mobile: test sidebar, tables, and forms on small viewports; use responsive utilities and PrimeNG responsive behavior.
- Skipping empty and loading states: they are part of the spec and prevent confusing blank screens.
- Using decorators for inputs/outputs in new code: prefer `input()` and `output()`.
- Adding NgModules for new features: use standalone components and `loadComponent` for routes.
- Ignoring AXE or contrast: fix a11y issues as you go; retrofitting is harder.

---

## 7. Updating this document

- When you fix a recurring bug or refactor a pattern, add a short note under the relevant section (Design, Component, State, Routing, Performance, or Common mistakes).
- Include: what went wrong, what was changed, and the rule to follow next time.
- Keep entries short and actionable so the doc stays useful.
