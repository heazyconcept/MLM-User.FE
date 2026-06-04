h6# Frontend Integration: Admin User Impersonation

Date: 2026-05-28

Admin and User dashboards are deployed on **separate origins**. Impersonation uses a **one-time exchange code** (not JWTs in the URL) so tokens never cross domains in query strings.

---

## API summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/admin/users/:id/impersonate` | Admin Bearer | Start impersonation; get `exchangeCode` + `redirectUrl` |
| `POST` | `/auth/impersonate/exchange` | Public (throttled) | Exchange code for user tokens |
| `POST` | `/auth/impersonate/end` | Impersonation Bearer + body `{ refreshToken }` | End session; get `adminDashboardUrl` |
| `GET` | `/auth/impersonation` | Bearer | Banner state from JWT (`isImpersonating`, ids, `expiresAt`) |

**Blocked during impersonation** (`403`, `error: IMPERSONATION_ACTION_BLOCKED`):

- `PUT /users/me/password`
- `POST /users/transaction-pin/set`, `PUT .../change`, `POST .../reset-request`, `POST .../reset`
- `POST /withdrawals/request`

`POST /auth/logout` remains allowed and ends the impersonation session.

---

## Server configuration

Set on the API (see `.env.example`):

| Variable | Example |
|----------|---------|
| `USER_DASHBOARD_URL` | `https://app.segulah.ng` |
| `ADMIN_DASHBOARD_URL` | `https://admin.segulah.ng` |
| `JWT_IMPERSONATION_ACCESS_EXPIRY` | `2h` (default) |
| `JWT_IMPERSONATION_REFRESH_EXPIRY` | `8h` (default) |
| `FRONTEND_ORIGIN` | Comma-separated **both** user and admin app origins (CORS) |

---

## A. Shared configuration (build-time)

| App | Variable | Example |
|-----|----------|---------|
| Admin FE | API base URL | `https://api.segulah.ng` |
| Admin FE | User dashboard URL | Same as API `USER_DASHBOARD_URL` (optional; API returns `redirectUrl`) |
| User FE | API base URL | `https://api.segulah.ng` |
| User FE | Admin dashboard URL | Same as API `ADMIN_DASHBOARD_URL` (optional; `/auth/impersonate/end` returns URL) |

**Storage (per origin only):**

- User FE: existing `accessToken`, `refreshToken`; add `segulah_impersonation` (JSON) for banner UI.
- Do **not** store admin tokens on the user app origin.

---

## B. Admin dashboard FE

### User list (`GET /admin/users`)

- Row action **Login as user** (hide/disable when `role === 'ADMIN'`).
- Flow:
  1. Confirm: “You will view the dashboard as {username}. Actions are audited.”
  2. `POST /admin/users/{id}/impersonate` with admin Bearer token.
  3. On `201`, open handoff URL:

```typescript
const url = `${response.redirectUrl}?code=${encodeURIComponent(response.exchangeCode)}`;
window.open(url, '_blank'); // recommended: keeps admin session in original tab
```

**Same-tab alternative:** save admin tokens to `sessionStorage` key `segulah_admin_session_backup`, then `location.href = url`. On return to admin origin, restore from backup.

### Start response shape

```json
{
  "exchangeCode": "opaque-string",
  "expiresInSeconds": 120,
  "redirectUrl": "https://app.segulah.ng/impersonate",
  "targetUser": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER"
  }
}
```

**Errors:** `404` user not found; `403` inactive user or target is ADMIN; `400` if `USER_DASHBOARD_URL` not configured.

---

## C. User dashboard FE

### Route: `/impersonate` (public)

1. Read `code` from query (`?code=...`). If missing → error page.
2. `POST /auth/impersonate/exchange` body `{ "exchangeCode": "..." }`.
3. Store `accessToken`, `refreshToken`, and `impersonation` from response.
4. `history.replaceState` to remove `code` from URL → navigate to `/dashboard` (or home).
5. On `400` → “Link expired or invalid” + link to login.

### Exchange response shape

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "impersonation": {
    "sessionId": "uuid",
    "adminId": "uuid",
    "adminUsername": "platformadmin",
    "targetUserId": "uuid",
    "targetUsername": "johndoe",
    "expiresAt": "2026-05-28T17:00:00.000Z"
  }
}
```

### Global banner (all authenticated layouts)

Example copy:

> Viewing as **@johndoe** (impersonated by admin). **[Exit to admin]**

- **Data:** `impersonation` from exchange, or `GET /auth/impersonation` on app boot.
- **Exit:**
  1. `POST /auth/impersonate/end` with Bearer + `{ "refreshToken": "..." }`.
  2. Clear tokens and `segulah_impersonation`.
  3. `window.location.href = response.adminDashboardUrl`.
  4. If `window.opener` is set (opened from admin), optionally `window.close()` after step 2.

### HTTP client

Use impersonation `accessToken` like a normal login. `POST /auth/refresh` preserves impersonation claims when rotating tokens.

### WebSockets

Connect with impersonation JWT; notifications are for the **target user** (expected for support).

---

## D. Security checklist

- Never pass JWTs in query params — only `exchangeCode`.
- Strip `code` from the URL immediately after exchange.
- Keep the banner visible on every page while impersonating.
- Do not expose “Login as user” on the user FE.
- Impersonation tokens cannot call `/admin/*` (JWT `role` is the target user’s role).

---

## E. QA checklist

- [ ] Admin impersonates active USER → user dashboard works as that user.
- [ ] Admin impersonates MERCHANT (non-admin) → same flow.
- [ ] Impersonate ADMIN → `403`.
- [ ] Expired/used code → error UI.
- [ ] Exit → user tokens cleared; redirect to admin URL; admin tab still logged in (new-tab flow).
- [ ] Impersonation token → `GET /admin/users` returns `403`.
- [ ] Password change / withdrawal / PIN change → `IMPERSONATION_ACTION_BLOCKED`.
- [ ] Audit: `USER_IMPERSONATION_START` / `USER_IMPERSONATION_END` in admin audit log.

---

## F. User FE (Angular) implementation guide (no code)

### 1) Add a public route for `/impersonate`
- Create a new route under the public/auth routes that does not require the normal auth guard.
- Ensure the route can render without access tokens in storage.

### 2) Impersonation exchange flow
- Read `code` from the query string. If missing, show a clear error state and a link back to login.
- Call `POST /auth/impersonate/exchange` with `{ exchangeCode: code }`.
- On success:
  - Store `accessToken`, `refreshToken`, and the `impersonation` object in local storage (per origin).
  - Immediately remove `code` from the URL using `history.replaceState`.
  - Navigate to the default authenticated landing page (e.g., `/dashboard`).
- On `400`, show a “Link expired or invalid” message with a retry/login link.

### 3) Global impersonation banner
- Add a banner to every authenticated layout (top of page, persistent) that reads from storage.
- Banner should show target username and “Exit to admin”.
- On app boot, if tokens exist but no `impersonation` in storage, call `GET /auth/impersonation` to populate banner state.

### 4) Exit flow
- On “Exit to admin” click:
  - Call `POST /auth/impersonate/end` with current access token and `{ refreshToken }`.
  - Clear user tokens and `segulah_impersonation` from storage.
  - Redirect to `adminDashboardUrl` from the response.
  - If the window was opened from admin (`window.opener` exists), optionally `window.close()` after clearing storage.

### 5) HTTP client integration
- Use impersonation `accessToken` exactly like a normal user token.
- Ensure refresh (`POST /auth/refresh`) preserves impersonation claims.

### 6) Blocked actions UI
- When the API returns `403` with `IMPERSONATION_ACTION_BLOCKED`, show a clear toast or inline message:
  “Action disabled during impersonation.”
- Apply this in password/PIN/withdrawal flows to avoid confusing errors.

### 7) Security guardrails
- Never store admin tokens on the user origin.
- Strip query `code` as soon as the exchange succeeds.
- Keep the banner visible for the entire impersonation session.
