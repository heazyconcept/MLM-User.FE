# Frontend Integration — Matrix Level & Successline Status

**Date:** 2026-06-17  
**Status:** **Shipped**  
**Audience:** User app — Matrix level table (`/network` successline / level views)

Related:

- [frontend-integration-matrix-cpv-notifications.md](./frontend-integration-matrix-cpv-notifications.md) — matrix tree, matrix **flow** (different `status` enum — see below)
- [BACKEND_UPDATE_USER_MANAGEMENT (2).md](../Febugs/BACKEND_UPDATE_USER_MANAGEMENT%20(2).md) — status rules (same as admin)
- [API-downlines-requirements.md](../Febugs/API-downlines-requirements.md) — flat downline list spec

---

## 1. Which endpoint to use

| Screen | Endpoint | Response |
|--------|----------|----------|
| **Matrix level table** (paginated, level 1–13) | `GET /referrals/me/matrix-level` | `{ status, data: { users[], pagination } }` |
| Flat downline list (optional) | `GET /referrals/me/downlines` | JSON **array** of items (same row fields) |
| Matrix stage tabs | `GET /referrals/me/matrix/flow` | **Unchanged** — still `ACTIVE` \| `UNPAID` \| `SUSPENDED` |

This doc covers **matrix-level** and **downlines**. Do **not** apply matrix-level `status` rules to **matrix/flow**.

---

## 2. Matrix level — `GET /referrals/me/matrix-level`

### Request

```http
GET /referrals/me/matrix-level?level=1&page=1&limit=20&search=
Authorization: Bearer <token>
```

| Query | Required | Default | Description |
|-------|----------|---------|-------------|
| `level` | Yes | — | Placement depth `1`–`13` |
| `page` | No | `1` | Page number |
| `limit` | No | `20` | Page size |
| `search` | No | — | Username, email, or phone (case-insensitive) |

**Level semantics**

- **Level 1:** depth-1 matrix children **∪** all direct referrals (deduped). May include **unpaid** members (`REGISTERED`).
- **Levels 2–13:** **paid** members only at that placement depth.

### Response

```json
{
  "status": "success",
  "data": {
    "levelRequested": 1,
    "pagination": {
      "totalRecords": 150,
      "currentPage": 1,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "users": [
      {
        "id": "uuid",
        "username": "johndoe",
        "email": "john@example.com",
        "phone": "+2348012345678",
        "joinDate": "2026-05-01T14:30:00.000Z",
        "registrationPackage": "GOLD",
        "package": "GOLD",
        "isActive": true,
        "isRegistrationPaid": true,
        "directReferralsCount": 2,
        "status": "INACTIVE"
      }
    ]
  }
}
```

> Top-level `status` is always `"success"` (envelope). Per-member MLM state is `data.users[].status`.

---

## 3. User row fields

| API field | Type | UI column / use |
|-----------|------|-----------------|
| `username` | string | Name column (primary) |
| `email` | string | Subtitle / fallback if no username |
| `phone` | string \| null | Contact column |
| `joinDate` | ISO string | Joined date |
| `registrationPackage` | `Package` | **Package badge** (use this) |
| `package` | `Package` | Alias — same as `registrationPackage` |
| `status` | enum below | **Status badge** |
| `directReferralsCount` | number | **DR** column |
| `isActive` | boolean | Do **not** use alone for status badge |
| `isRegistrationPaid` | boolean | Optional tooltip |

### Package enum

`NICKEL` | `SILVER` | `GOLD` | `PLATINUM` | `RUBY` | `DIAMOND`

```typescript
const pkg = row.registrationPackage ?? row.package;
```

### MLM `status` enum (per user)

| `status` | When | Suggested label |
|----------|------|-----------------|
| `SUSPENDED` | Account disabled (`isActive === false`) | Suspended |
| `REGISTERED` | Active account, registration **not** paid | Registered |
| `ACTIVATED` | Paid; DR count unavailable (rare / migration) | Activated |
| `ACTIVE` | Paid + **≥ 3** direct referrals | Active |
| `INACTIVE` | Paid + **< 3** direct referrals | Inactive |

`directReferralsCount` = users who registered with this member as sponsor (`referredById`). Threshold for **Active** = **3** (same as admin user management).

### Breaking change (matrix-level only)

| Removed | Replacement |
|---------|-------------|
| `UNPAID` | `REGISTERED` |
| `ACTIVE` (any paid user) | `ACTIVE` or `INACTIVE` based on DR count |
| `SUSPENDED` | `SUSPENDED` (unchanged) |

---

## 4. Flat downline list — `GET /referrals/me/downlines`

Same **per-member** fields as matrix-level rows, but:

- Response is a **plain array** (not `{ data: { users } }`).
- Optional query: `depth` (max tree depth).
- Also includes: `level`, `teamSize`, `rank`, `stage`, `isDirectReferral`, `firstName`, `lastName`.

```http
GET /referrals/me/downlines?depth=13
Authorization: Bearer <token>
```

Use the same `status` / `registrationPackage` / `directReferralsCount` mapping as matrix-level.

---

## 5. TypeScript

```typescript
export type MlmManagementStatus =
  | 'SUSPENDED'
  | 'REGISTERED'
  | 'ACTIVATED'
  | 'ACTIVE'
  | 'INACTIVE';

export type PackageTier =
  | 'NICKEL'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'RUBY'
  | 'DIAMOND';

export type MatrixLevelUserRow = {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  joinDate: string;
  registrationPackage: PackageTier;
  package: PackageTier;
  status: MlmManagementStatus;
  isActive: boolean;
  isRegistrationPaid: boolean;
  directReferralsCount: number;
};

export type MatrixLevelResponse = {
  status: 'success';
  data: {
    levelRequested: number;
    pagination: {
      totalRecords: number;
      currentPage: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    users: MatrixLevelUserRow[];
  };
};

export async function fetchMatrixLevel(params: {
  level: number;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<MatrixLevelResponse> {
  const q = new URLSearchParams({
    level: String(params.level),
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  if (params.search?.trim()) q.set('search', params.search.trim());
  return api.get(`/referrals/me/matrix-level?${q}`);
}
```

### Status badge helper

```typescript
const STATUS_LABEL: Record<MlmManagementStatus, string> = {
  SUSPENDED: 'Suspended',
  REGISTERED: 'Registered',
  ACTIVATED: 'Activated',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

function memberStatusLabel(row: MatrixLevelUserRow): string {
  return STATUS_LABEL[row.status] ?? row.status;
}

// Do NOT use:
// row.isActive ? 'Active' : 'Inactive'
```

### Pagination

Use `data.pagination.hasNextPage` / `hasPreviousPage` for controls. `totalRecords` drives total count display.

---

## 6. FE implementation checklist

- [ ] Call `GET /referrals/me/matrix-level?level={n}&page=&limit=` for the level table screen.
- [ ] Bind **package** column to `registrationPackage` (fallback `package`).
- [ ] Bind **status** badge to `row.status` — remove logic that maps `isActive` or old `UNPAID`.
- [ ] Bind **DR** column to `directReferralsCount` (or `directReferrals` on downlines endpoint).
- [ ] Handle pagination via `data.pagination`.
- [ ] Optional: wire `search` query param to your search input.
- [ ] **Matrix flow** (`/referrals/me/matrix/flow`) — keep existing `ACTIVE` \| `UNPAID` \| `SUSPENDED` handling until that endpoint is updated separately.

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-06-17 | Matrix-level + downlines: `registrationPackage`, `directReferralsCount`, admin MLM `status` |
