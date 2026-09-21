# Frontend → Backend Issue Handoff (Example Pack)

**Purpose:** Portable example your team can copy into any frontend repo so humans and agents write the same backend handoff docs.

**Not tied to a specific product.** Replace placeholders (`your-frontend-app`, `docs/`, `src/…`) with your paths.

## What to copy into the other project

```
docs/
  BACKEND_ISSUE_GUIDE.md      ← this file (or keep the name)
  BACKEND_BUG_TEMPLATE.md
  BACKEND_REQUEST_TEMPLATE.md
  examples/                   ← optional filled samples for training
    EXAMPLE_BACKEND_BUG.md
    EXAMPLE_BACKEND_REQUEST.md
```

Optional for Cursor agents: add a project skill that points at this guide whenever someone asks to file a backend bug or API request.

## When to write which doc

| Prefix | Filename example | Use when |
|--------|------------------|----------|
| `BACKEND_BUG_` | `BACKEND_BUG_CHECKOUT_DEBITS_WRONG_WALLET.md` | Endpoint exists but returns wrong data, wrong status, or wrong side effect |
| `BACKEND_REQUEST_` | `BACKEND_REQUEST_PROFILE_COMPLETE_FLAG.md` | Need new fields, endpoints, validation, or a contract change |

## Rules for humans and agents

1. **One issue per file.** Do not bundle unrelated bugs or requests.
2. **Evidence over opinion.** For bugs: method, path, request body, status, response body.
3. **Prove FE is not the cause.** Show the exact payload FE sends and file paths.
4. **Contracts must be copy-pasteable.** JSON examples + field tables (name \| type \| required \| meaning).
5. **Acceptance criteria must be binary.** Prefer checkable statements over “works correctly.”
6. **Name endpoints and enums exactly.** Example: `POST /orders/:id/pay`, `VOUCHER` — not “voucher somehow.”
7. **State ownership.** Say whether backend must enforce the rule vs FE-only UX.
8. **Update Status** when work moves: `Open` → `In progress` → `Shipped` / `Blocked`.
9. **Additive by default.** Call out breaking changes explicitly.
10. **Include FE follow-up.** What the frontend will do after backend ships.

## Required header fields

```markdown
# Backend [Bug Report|Request] — <short outcome-focused title>

**Date:** YYYY-MM-DD
**From:** Frontend (`your-frontend-app`)
**Status:** Open | In progress | Shipped | Blocked
**Severity:** Critical | High | Medium | Low
**Area:** <feature / domain>
**Endpoints:** `METHOD /path`, `METHOD /path`

**Related FE:**
- [`file.ts`](../src/...)
```

## Severity guide

| Severity | Meaning |
|----------|---------|
| Critical | Blocks auth, payment, or core money movement; data corruption risk |
| High | Wrong balances/counts; users blocked on a main flow |
| Medium | Wrong display or incomplete contract; workaround exists |
| Low | Nice-to-have enrichment, optional fields, polish |

## Checklist before sharing with backend

- [ ] Filename uses `BACKEND_BUG_` or `BACKEND_REQUEST_`
- [ ] Header has Date, Status, Severity, Area, Endpoints
- [ ] Summary is one short paragraph with user/business impact
- [ ] Repro steps are numbered and runnable
- [ ] Bug has exact request + response; request has proposed JSON shapes
- [ ] Field tables include types and meanings
- [ ] Acceptance criteria are checkboxes
- [ ] Out of scope is listed
- [ ] Related FE files are linked

## After backend ships

1. Set **Status** to `Shipped` and add a Changelog row.
2. Implement the FE follow-up section.
3. Add a permanent integration guide only when the contract is large enough to need one.

## Agent instruction (paste into AGENTS.md or a Cursor skill)

```text
When filing a backend bug or API change request, copy docs/BACKEND_BUG_TEMPLATE.md
or docs/BACKEND_REQUEST_TEMPLATE.md, fill every header field, one issue per file,
and follow docs/BACKEND_ISSUE_GUIDE.md. Do not invent a new format.
```
