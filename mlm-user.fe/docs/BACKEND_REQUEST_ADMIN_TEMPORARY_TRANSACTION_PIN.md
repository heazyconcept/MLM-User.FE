# Backend Request — Admin Temporary Transaction PIN

**Status:** Not shipped (HerbApi)  
**Full specification:** [BACKEND_REQUEST_ADMIN_TEMPORARY_TRANSACTION_PIN.md](../../../MLM-admin.FE/BACKEND_REQUEST_ADMIN_TEMPORARY_TRANSACTION_PIN.md) in the Admin FE repo (canonical).

**Summary for Member FE:**

- Admin issues a **time-limited temporary PIN** via `POST /admin/users/:userId/transaction-pin/temporary`.
- Member sets a **new permanent PIN** via **`POST /users/transaction-pin/setup-with-temporary`** (new endpoint).
- Temporary PIN works **only** on that setup endpoint — **not** for withdrawals or transfers.
- **Blocked during impersonation** (`IMPERSONATION_ACTION_BLOCKED`); member must use their own login session.

When backend ships, update [transaction-pin-api.md](./transaction-pin-api.md) and implement Profile recovery UI in `user.service.ts` / `profile.component.ts`.
