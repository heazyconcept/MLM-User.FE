# Registration Payment Requirements

This document describes what is needed for the registration payment flow to work end-to-end.

---

## Status: Ready — Backend Implemented

**As of:** February 2026

Backend has confirmed and implemented the payment endpoints. Frontend is aligned with backend API (callbackUrl, response shape).

---

## 1. Backend API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /payments/registration/initiate` | Initiates registration payment; returns reference and optionally gateway URL |
| `POST /payments/verify` | Verifies payment using the reference |

---

## 2. Response from `POST /payments/registration/initiate`

The frontend expects the 201 response to include at least one of:

- **`reference`** — Payment reference (required for verification)
- **`authorizationUrl`** or **`gatewayUrl`** — URL to redirect user to Paystack/Flutterwave (or similar)

**Flow:**
- If a gateway URL is returned → user is redirected to the payment gateway to pay
- If no gateway URL → user sees a "payment pending" screen with the reference and a "Verify" button (e.g. for USDT/manual payment)

---

## 3. Callback URL (for Gateway Redirect)

When using Paystack, the gateway redirects the user back to the app after payment:

- **URL:** `https://your-frontend-domain.com/auth/payment/callback`
- **Query param:** `reference` (e.g. `?reference=pay_xxx`)

The backend accepts optional **`callbackUrl`** (string) in the initiate request body. If provided, it is sent to Paystack as `callback_url`. If omitted, the backend may use a default from env (`PAYMENT_CALLBACK_BASE_URL` + `/auth/payment/callback`) when set.

---

## 4. Frontend Configuration

- **Base URL:** `https://segulah-api.onrender.com` (set in `environment.ts`)
- **Auth:** User must be logged in (Bearer token) when calling both `initiate` and `verify`

---

## 5. Backend Answers (implemented)

1. **Response shape (201):** `paymentId`, `reference`, `amount`, `currency`, and when using Paystack: **`gatewayUrl`** (URL to redirect the user to complete payment). For USDT/manual no `gatewayUrl` is returned.
2. **Callback URL:** The backend accepts an optional **`callbackUrl`** (string) in the initiate request body. If provided, it is sent to Paystack as `callback_url`. If omitted, the backend may use a default from env when set.
3. **Providers:** **PAYSTACK** (default) and **USDT** are supported for registration. For **PAYSTACK** the response includes **`gatewayUrl`**; for **USDT** (manual) the response has no **`gatewayUrl`** so the frontend shows a "payment pending" screen with the reference and a Verify button. **FLUTTERWAVE** is planned for a later phase.

---

## 6. Current Frontend Implementation

- **PaymentService** — `initiateRegistrationPayment(package, currency, callbackUrl?)` and `verifyPayment(reference)`
- **Register component** — After registration, calls initiate with `callbackUrl` (e.g. `window.location.origin + '/auth/payment/callback'`); if `gatewayUrl` is returned, redirects to gateway; otherwise shows payment-pending screen with reference and Verify button
- **Payment callback route** — `/auth/payment/callback?reference=xxx` verifies payment and redirects to onboarding or dashboard
