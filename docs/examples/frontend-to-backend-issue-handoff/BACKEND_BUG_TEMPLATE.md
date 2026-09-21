# Backend Bug Report — <SHORT_OUTCOME_TITLE>

**Date:** YYYY-MM-DD  
**From:** Frontend (`your-frontend-app`)  
**Status:** Open  
**Severity:** Critical | High | Medium | Low  
**Area:** <feature / domain>  
**Endpoints:** `METHOD /path`

**Related FE:**

- [`path/to/file.ts`](../src/path/to/file.ts)

---

## 1. Summary

<One short paragraph: what is wrong and why it matters.>

## 2. User impact

- <What the user sees or cannot do>
- <Money / trust / fulfilment impact if any>

## 3. Reproduction steps

1. <Step>
2. <Step>
3. <Step>
4. Observe <failure>

## 4. Actual vs expected

| | |
|--|--|
| **Actual** | <what happens now> |
| **Expected** | <what should happen> |

## 5. Evidence

### Request

- **Endpoint:** `METHOD /path`
- **Body:**

```json
{
}
```

### Response

```json
{
  "statusCode": 400,
  "message": "",
  "error": "Bad Request",
  "path": "/path"
}
```

### Observed state at failure time

- <balances, counts, IDs, currencies, statuses>

## 6. Frontend verification

Frontend already:

- Sends: <exact fields / enum mapping>
- Does **not** <common mis-blame>

Code references:

- `<file>` — `<what it does>`

## 7. Suspected backend issues

1. <hypothesis>
2. <hypothesis>

## 8. Suggested backend checks

1. <log / validate / test idea>
2. <log / validate / test idea>

## 9. Minimal contract (if a fix needs an explicit contract)

For `METHOD /path`:

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `field` | string | yes | … |

Error when invalid:

```json
{
  "statusCode": 400,
  "code": "EXAMPLE_CODE",
  "message": "…"
}
```

## 10. Acceptance criteria

- [ ] <binary, testable check>
- [ ] <binary, testable check>
- [ ] <known fixture or account if available>

## 11. Out of scope

- <what this ticket is not asking for>

## 12. Changelog

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | Frontend | Initial report |
