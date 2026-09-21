# Backend Request — <SHORT_OUTCOME_TITLE>

**Date:** YYYY-MM-DD  
**From:** Frontend (`your-frontend-app`)  
**Status:** Open  
**Severity:** Critical | High | Medium | Low  
**Area:** <feature / domain>  
**Endpoints:** `METHOD /path`, `METHOD /path`

**Related FE:**

- [`path/to/file.ts`](../src/path/to/file.ts)
- Related docs: [related.md](./related.md)

---

## 1. Summary

<One short paragraph: what is needed and why FE cannot solve it alone.>

## 2. Current behavior (reproduction)

1. <Step>
2. <Step>
3. Observe <gap>

**Observed:** <what users see today>  
**Root cause (if known):**

| Layer / endpoint | Current behavior | Problem |
|------------------|------------------|---------|
| `METHOD /path` | … | … |

## 3. Required API changes

### 3.1 `METHOD /path`

**Change type:** additive field | new endpoint | validation | behavior fix

**Proposed response / request:**

```json
{
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `field` | boolean | yes | … |

**Invariants (if any):**

- `<a + b === total>`

### 3.2 Error contract (if FE must branch)

```json
{
  "statusCode": 400,
  "code": "EXAMPLE_CODE",
  "message": "…",
  "missingFields": []
}
```

| Field | Required |
|-------|----------|
| `code` | exact string FE will match |

## 4. Shared types (optional)

Reuse one shape across endpoints when the same UI object appears in multiple places:

```json
{
  "id": "uuid",
  "displayName": "…"
}
```

## 5. Ownership / business rules

- Backend must own: <rules that cannot be client-only>
- Frontend will own: <display / prompts only>

## 6. What the frontend will do after this ships

| Moment / screen | FE behavior |
|-----------------|-------------|
| Login / page X | … |
| Action Y | … |

Until the API ships, FE will: <fallback or blocked state>.

## 7. Acceptance criteria

- [ ] <binary, testable check>
- [ ] <binary, testable check>
- [ ] OpenAPI / API docs updated if schema changed
- [ ] Known fixture returns expected shape (if available)

## 8. Out of scope

- <explicit non-goals>

## 9. Test fixture (optional)

| Category | Count / value |
|----------|---------------|
| … | … |

**After fix, expect:**

```json
{
}
```

## 10. Changelog

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | Frontend | Initial request |
