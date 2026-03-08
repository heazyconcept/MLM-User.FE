# Segulah API – Frontend integration reference

**Base URL:** `http://localhost:3000` (override with env: `PORT` for port, `API_BASE_URL` for full URL used in Swagger and docs). No path prefix.

**CORS:** The API does not enable CORS by default. For frontend apps on a different origin, configure CORS in `main.ts` (e.g. `app.enableCors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' })` or allow list). Adjust allowed origins per environment.

- **Interactive docs:** [GET /api/docs](http://localhost:3000/api/docs) (Swagger UI)
- **OpenAPI JSON:** [GET /api/docs-json](http://localhost:3000/api/docs-json) — use for client codegen (e.g. openapi-typescript). To save to repo: run the API, then `npm run openapi:dump` to write `docs/openapi.json`.

---

## Quick start

1. **Register:** `POST /auth/regi ster` with `{ email, password, package, currency, referralCode? }` → returns `{ accessToken, refreshToken }`.
2. **Login:** `POST /auth/login` with `{ email, password }` → returns `{ accessToken, refreshToken }`.
3. **Call protected routes:** Send header `Authorization: Bearer <accessToken>`.
4. **Refresh token:** `POST /auth/refresh` with `{ refreshToken }` → returns new `{ accessToken, refreshToken }`.
5. **Profile:** `GET /users/me` (Bearer) → user profile. After registration is paid, `GET /wallets` for wallet summary.

---

## Authentication

- **Header:** `Authorization: Bearer <accessToken>` for all protected routes.
- **Login/register response:** `{ accessToken: string, refreshToken: string }`.
- **Refresh:** `POST /auth/refresh` body `{ refreshToken: string }`.
- **Logout:** `POST /auth/logout` (Bearer) body `{ refreshToken: string }`.

---

## Error response

All errors return JSON:

```json
{
  "statusCode": 400,
  "message": ["validation error message or array of messages"],
  "error": "Bad Request",
  "timestamp": "2025-02-16T12:00:00.000Z",
  "path": "/orders"
}
```

| statusCode | Meaning |
|------------|--------|
| 400 | Validation failed (invalid body/query); `message` is string[] |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (e.g. registration not paid, not merchant, not admin, withdrawal not eligible) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email, duplicate idempotency key) |
| 429 | Rate limit exceeded (throttle) |

---

## Guards and preconditions

- **JWT:** Almost all routes except auth (register, login, refresh, forgot/reset password) and `POST /referrals/validate` require a valid Bearer token.
- **RegistrationPaidGuard:** User must have completed registration payment. Required for: `GET/PUT /wallets`, `GET /earnings`, `POST /withdrawals/request`, `GET /withdrawals`, `GET /withdrawals/:id`, payments (except `POST /payments/registration/initiate` and `POST /payments/verify`), `POST /orders`, order list/detail. If not paid → **403**.
- **MerchantGuard:** User must be an active merchant. Required for: `GET /merchants/orders`, `GET /merchants/orders/:id`, `POST /merchants/orders/:id/mark-ready-for-pickup`, `POST /merchants/orders/:id/mark-delivery-requested`, `POST /merchants/orders/:id/confirm-delivery`, `GET /merchants/deliveries`, `GET /merchants/earnings/summary`. If not merchant → **403**.
- **Admin (RolesGuard + Role.ADMIN):** All routes under `GET|POST|PUT|DELETE /admin/*`, `GET /admin/audit`, `GET /admin/reports/*`, and wallet lock/unlock `PUT /wallets/:id/lock`, `PUT /wallets/:id/unlock`. If not admin → **403**.
- **WithdrawalEligibilityGuard:** `POST /withdrawals/request` may return **403** if user is not eligible (e.g. balance, rules).

---

## Enums (for request/response bodies and filters)

Use these values in API requests and responses. Frontend can generate types from the OpenAPI spec (e.g. openapi-typescript).

| Enum | Values |
|------|--------|
| **Role** | USER, ADMIN, MERCHANT |
| **Package** | SILVER, GOLD, PLATINUM, RUBY, DIAMOND |
| **Currency** | NGN, USD |
| **WalletType** | CASH, VOUCHER, AUTOSHIP |
| **WalletStatus** | ACTIVE, LOCKED |
| **OrderStatus** | PENDING, CREATED, PAID, ASSIGNED_TO_MERCHANT, READY_FOR_PICKUP, OFFLINE_DELIVERY_REQUESTED, FULFILLED, DELIVERED, COMPLETED, CANCELLED, FAILED |
| **PaymentMethod** | WALLET, GATEWAY |
| **FulfilmentMode** | PICKUP, OFFLINE_DELIVERY |
| **MerchantType** | REGIONAL, NATIONAL, GLOBAL |
| **MerchantStatus** | PENDING, ACTIVE, SUSPENDED |
| **WithdrawalStatus** | PENDING, APPROVED, REJECTED, PAID |
| **PaymentStatus** | INITIATED, SUCCESS, FAILED |
| **PaymentProvider** | PAYSTACK, FLUTTERWAVE, USDT, ADMIN, DIRECT_ACCOUNT |
| **PaymentType** | REGISTRATION, UPGRADE, WALLET_FUNDING, ADMIN_FUNDING, USDT_FUNDING, PRODUCT_PURCHASE |
| **ProductStatus** | DRAFT, ACTIVE, INACTIVE |
| **NotificationChannel** | IN_APP, EMAIL, SMS, PUSH |
| **NotificationType** | USER_REGISTERED, REGISTRATION_ACTIVATED, PASSWORD_CHANGED, ACCOUNT_DISABLED, PAYMENT_INITIATED, PAYMENT_VERIFIED, WALLET_CREDITED, WALLET_LOCKED, WALLET_UNLOCKED, EARNING_CREDITED, CPV_MILESTONE_REACHED, RANK_UPGRADED, STAGE_COMPLETED, WITHDRAWAL_REQUESTED, WITHDRAWAL_APPROVED, WITHDRAWAL_REJECTED, WITHDRAWAL_PAID, ORDER_CREATED, ORDER_PAID, ORDER_COMPLETED, ORDER_CANCELLED, ORDER_FAILED, ORDER_FULFILLED, ORDER_READY_FOR_PICKUP, ORDER_DELIVERY_REQUESTED, MERCHANT_APPLICATION_SUBMITTED, MERCHANT_APPROVED, MERCHANT_REJECTED, MERCHANT_SUSPENDED, ORDER_ASSIGNED_TO_MERCHANT, MERCHANT_BONUS_CREDITED, ADMIN_ACTION_TAKEN, SYSTEM_ANNOUNCEMENT |
| **LedgerSource** | DEPOSIT, EARNING, WITHDRAWAL, REVERSAL, SYSTEM, ADMIN, MERCHANT, PRODUCT_PURCHASE |
| **LedgerEarningType** | PDPA, CDPA, DIRECT_REFERRAL, COMMUNITY_REFERRAL, PERSONAL_PRODUCT_PURCHASE, DIRECT_REFERRAL_PRODUCT_PURCHASE, COMMUNITY_PRODUCT_PURCHASE, REPEAT_PRODUCT_PURCHASE, MATCHING_BONUS, RANKING_BONUS, CPV_CASH_BONUS, CPV_MILESTONE_INCENTIVE, LEADERSHIP_BONUS, MERCHANT_PERSONAL_PRODUCT, MERCHANT_DIRECT_REFERRAL_PRODUCT, MERCHANT_COMMUNITY_PRODUCT, MERCHANT_DELIVERY_BONUS |

---

## Pagination and query conventions

Endpoints that support list/pagination typically use:

- **limit** (optional, number, default often 20)
- **offset** (optional, number, default often 0)

Date filters (when present) use ISO 8601 strings, e.g. **fromDate** / **toDate** or **from** / **to**.

| Endpoint | Query params |
|----------|--------------|
| GET /orders | status?, fromDate?, toDate?, limit?, offset? |
| GET /payments | limit?, offset? |
| GET /withdrawals | limit?, offset? |
| GET /notifications | type?, isRead?, limit?, offset? |
| GET /audit/me | action?, entityType?, from?, to?, limit?, offset? |
| GET /admin/audit | actorId?, actorType?, action?, entityType?, entityId?, from?, to?, limit?, offset? |
| GET /admin/withdrawals | status?, userId?, fromDate?, toDate?, limit?, offset? |
| GET /admin/merchants | (filters per AdminMerchantFiltersDto) |
| GET /admin/orders | (filters per AdminOrderFiltersDto) |
| GET /products | categoryId?, limit?, offset? |

---

## Endpoint reference

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | None | Health / hello |

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | None | Register; body: email, password, package, currency, referralCode? |
| POST | /auth/login | None | Login; body: email, password |
| POST | /auth/refresh | None | Refresh tokens; body: refreshToken |
| POST | /auth/logout | Bearer | Logout; body: refreshToken |
| POST | /auth/forgot-password | None | Forgot password; body: email |
| POST | /auth/reset-password | None | Reset password; body: token, newPassword |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/me | Bearer | Current user profile |
| PUT | /users/me | Bearer | Update profile; body: phone? |
| PUT | /users/me/password | Bearer | Change password; body: currentPassword, newPassword |
| GET | /users/me/referral | Bearer | Referral code and referrer info |
| GET | /users/me/upgrade-options | Bearer | Upgrade package options |

### Referrals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /referrals/validate | None | Validate referral code; body: referralCode |
| GET | /referrals/me/upline | Bearer | My upline tree |
| GET | /referrals/me/downlines | Bearer | My downlines; query: depth? |
| GET | /referrals/me/sponsor | Bearer | My sponsor |
| GET | /referrals/me/placement | Bearer | My placement |

### Wallets (requires RegistrationPaid)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /wallets | Bearer + RegPaid | Wallet summary (cash, voucher, autoship) |
| GET | /wallets/:type | Bearer + RegPaid | Wallet by type (CASH, VOUCHER, AUTOSHIP) |
| PUT | /wallets/:id/lock | Bearer + Admin | Lock wallet |
| PUT | /wallets/:id/unlock | Bearer + Admin | Unlock wallet |

### Earnings (requires RegistrationPaid)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /earnings | Bearer + RegPaid | My earnings list |
| GET | /earnings/summary | Bearer + RegPaid | Earnings summary |
| GET | /earnings/cpv | Bearer + RegPaid | CPV summary and history |
| GET | /earnings/ranking | Bearer + RegPaid | Ranking and history |

### Withdrawals (requires RegistrationPaid)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /withdrawals/request | Bearer + RegPaid + Eligibility | Request withdrawal; body: amount |
| GET | /withdrawals | Bearer + RegPaid | My withdrawals; query: limit?, offset? |
| GET | /withdrawals/:id | Bearer + RegPaid | Withdrawal by id |

### Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /payments/registration/initiate | Bearer | Start registration payment; body: package, currency |
| POST | /payments/upgrade/initiate | Bearer + RegPaid | Start upgrade payment; body: targetPackage |
| POST | /payments/wallet-funding/initiate | Bearer + RegPaid | Start wallet funding; body: amount, provider |
| POST | /payments/verify | Bearer | Verify payment; body: reference, gatewayResponse? |
| GET | /payments | Bearer + RegPaid | My payments; query: limit?, offset? |
| GET | /payments/:id | Bearer + RegPaid | Payment by id |

### Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /products | Bearer | Catalog; query: categoryId?, limit?, offset? |
| GET | /products/:id | Bearer | Product by id |

### Orders (create requires RegistrationPaid)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /orders | Bearer + RegPaid | Create order; body: items[], paymentMethod, fulfilmentMode, selectedMerchantId?, deliveryAddress?, deliveryDisclaimerAccepted?, idempotencyKey? |
| POST | /orders/:id/pay-wallet | Bearer | Pay order with wallet |
| GET | /orders | Bearer | My orders; query: status?, fromDate?, toDate?, limit?, offset? |
| GET | /orders/:id | Bearer | Order by id |
| POST | /orders/:id/cancel | Bearer | Cancel unpaid order |

### Merchants

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /merchants/apply | Bearer + RegPaid | Apply as merchant; body: type, serviceAreas[] |
| GET | /merchants/available | Bearer + RegPaid | Available merchants (e.g. for pickup); query per AvailableMerchantsQueryDto |
| GET | /merchants/me | Bearer | Current merchant profile |
| GET | /merchants/orders | Bearer + Merchant | Merchant orders; query: status?, limit?, offset? |
| GET | /merchants/orders/:id | Bearer + Merchant | Order detail |
| POST | /merchants/orders/:id/mark-ready-for-pickup | Bearer + Merchant | Mark ready for pickup |
| POST | /merchants/orders/:id/mark-delivery-requested | Bearer + Merchant | Mark delivery requested |
| POST | /merchants/orders/:id/confirm-delivery | Bearer + Merchant | Confirm delivery; body: proof?, notes? |
| GET | /merchants/deliveries | Bearer + Merchant | Delivery list |
| GET | /merchants/earnings/summary | Bearer + Merchant | Merchant earnings summary |

### Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /notifications | Bearer | List; query: type?, isRead?, limit?, offset? |
| GET | /notifications/unread-count | Bearer | Unread count |
| PUT | /notifications/:id/read | Bearer | Mark as read |
| PUT | /notifications/read-all | Bearer | Mark all as read |

### Audit

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /audit/me | Bearer | Current user audit log; query: action?, entityType?, from?, to?, limit?, offset? |
| GET | /admin/audit | Bearer + Admin | Admin audit search; query: actorId?, action?, entityType?, entityId?, from?, to?, limit?, offset? |

### Admin (all require Bearer + Admin)

| Method | Path | Description |
|--------|------|-------------|
| PUT | /admin/users/:id/status | Update user active status |
| POST | /admin/withdrawals/:id/approve | Approve withdrawal |
| POST | /admin/withdrawals/:id/reject | Reject withdrawal; body: reason |
| POST | /admin/withdrawals/:id/mark-paid | Mark paid; body: payoutReference |
| GET | /admin/withdrawals | List withdrawals; query: status?, userId?, fromDate?, toDate?, limit?, offset? |
| POST | /admin/payments/fund | Admin fund user; body per AdminFundingDto |
| GET | /admin/payments | List payments; query filters |
| POST | /admin/payments/:id/verify | Verify payment by id |
| GET | /admin/users | List users; query per UserFiltersDto |
| POST | /admin/users/:id/reset-password | Reset user password |
| GET | /admin/packages | Package configs |
| PUT | /admin/packages/:package | Update package config |
| GET | /admin/commission-rules | Commission rules |
| PUT | /admin/commission-rules | Update commission rules |
| GET | /admin/cpv-rules | CPV rules |
| PUT | /admin/cpv-rules | Update CPV rules |
| GET | /admin/ranking-rules | Ranking rules |
| PUT | /admin/ranking-rules | Update ranking rules |
| POST | /admin/wallets/:id/adjust | Wallet adjustment; body per WalletAdjustmentDto |
| GET | /admin/settings | System settings |
| PUT | /admin/settings | Update system settings |
| POST | /admin/notifications/broadcast | Broadcast announcement; body per BroadcastAnnouncementDto |

### Admin – Merchants

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/merchants | Admin | List merchants; query filters |
| GET | /admin/merchants/:id | Admin | Merchant by id |
| POST | /admin/merchants/:id/approve | Admin | Approve merchant |
| POST | /admin/merchants/:id/reject | Admin | Reject; body: reason? |
| POST | /admin/merchants/:id/suspend | Admin | Suspend; body: reason? |
| POST | /admin/merchants/:id/reactivate | Admin | Reactivate |
| POST | /admin/merchants/:id/products | Admin | Assign product; body: productId |
| DELETE | /admin/merchants/:id/products/:productId | Admin | Remove product |
| GET | /admin/merchants/:id/products | Admin | Merchant products |
| POST | /admin/merchants/:id/orders/:orderId/confirm-delivery | Admin | Confirm delivery for order |

### Admin – Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/orders | Admin | List orders; query filters |
| GET | /admin/orders/:id | Admin | Order by id |
| POST | /admin/orders/:id/assign-merchant | Admin | Assign merchant; body: merchantId |

### Admin – Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /admin/categories | Admin | Create category |
| PUT | /admin/categories/:id | Admin | Update category |
| GET | /admin/categories | Admin | List categories |
| POST | /admin/products | Admin | Create product |
| PUT | /admin/products/:id | Admin | Update product |
| PUT | /admin/products/:id/status | Admin | Update product status |
| POST | /admin/products/:id/price | Admin | Set product price |
| GET | /admin/products | Admin | List products; query filters |
| GET | /admin/products/:id/price-history | Admin | Price history |

### Admin – Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/reports/financial | Admin | Financial report; query: from?, to? |
| GET | /admin/reports/earnings | Admin | Earnings report; query: from?, to? |

---

## Important flows

### Registration and first payment

1. `POST /auth/register` with email, password, package, currency, optional referralCode → receive tokens.
2. `POST /payments/registration/initiate` with package, currency (Bearer) → receive reference, gatewayUrl (if gateway).
3. User completes payment on gateway (redirect or callback).
4. `POST /payments/verify` with reference, optional gatewayResponse → payment verified; registration becomes paid. After this, wallet/earnings/withdrawals/order-create become allowed.

### Create and pay for an order

1. `POST /orders` (Bearer + RegPaid) with items `[{ productId, quantity }]`, paymentMethod (WALLET or GATEWAY), fulfilmentMode (PICKUP or OFFLINE_DELIVERY). For PICKUP send selectedMerchantId; for OFFLINE_DELIVERY send deliveryAddress and deliveryDisclaimerAccepted. Optional idempotencyKey to avoid duplicate creates.
2. If paymentMethod is WALLET: `POST /orders/:id/pay-wallet` to pay with wallet.
3. If paymentMethod is GATEWAY: use payments flow (initiate then verify with order reference as needed).

### Wallet funding

1. `POST /payments/wallet-funding/initiate` (Bearer + RegPaid) with amount, provider (e.g. PAYSTACK, FLUTTERWAVE).
2. User completes payment on gateway.
3. `POST /payments/verify` with reference (and optional gatewayResponse) → wallet credited.

---

For full request/response schemas and examples, use **Swagger UI** at `/api/docs` or generate a client from the OpenAPI spec.
