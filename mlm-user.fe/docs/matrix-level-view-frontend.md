# Frontend Integration: Matrix Level Viewer

Date: May 4, 2026
Source: Adapted from docs/Febugs/MATRIX_LEVEL_VIEW_PLAN.md and current referrals implementation

Purpose
- Describe how the frontend should integrate a "Matrix Level Viewer" UI that shows all users at a specific matrix level for the authenticated user.
- Provide concrete API recommendations, request examples, pagination/search rules, UI guidance, TypeScript types, and a fallback approach using existing endpoints.

Summary of constraints from backend
- The referral system materializes a placement tree in `ReferralTree` with absolute `level` and `path` fields.
- Current repository APIs include `findDownlinesByPath(path, maxDepth)` and `countDownlinesByPath(userId)` (see implementation in referrals module).
- There is no dedicated endpoint that directly returns members at an exact absolute matrix level with server-side pagination/search yet.

Recommended API (Backend change request)
- Endpoint: `GET /referrals/me/levels`
- Purpose: return paginated users who belong to the authenticated user's downline at an exact relative level.

Query parameters
- `level` (required): integer 1..13 (1 = direct children relative to the requesting user)
- `limit` (optional): integer, default 20, max 200
- `offset` (optional): integer, default 0
- `search` (optional): string to filter by `username` | `email` | `phone`

Auth
- Bearer token required. Server must infer `currentUser.id` from token and scope queries to that user's tree.

Successful response (recommended JSON)
```json
{
  "status": "success",
  "data": {
    "levelRequested": 3,
    "pagination": {
      "totalRecords": 152,
      "currentOffset": 0,
      "limit": 20,
      "hasNext": true
    },
    "users": [
      {
        "id": "uuid",
        "username": "alice",
        "email": "alice@example.com",
        "phone": "+234801...",
        "joinDate": "2026-05-01T10:00:00.000Z",
        "status": "ACTIVE",
        "isDirectReferral": false,
        "profilePhotoUrl": "https://..."
      }
    ]
  }
}
```
Notes about fields
- `isDirectReferral`: computed server-side as `user.referredById === currentUser.id` (useful when level = 1 but may be false for spillover nodes). Keep for UI badges.
- `status`: map of registration/activation state, e.g. `ACTIVE`, `UNPAID`, `SUSPENDED` (defined by backend).

Sorting
- Server should order by `createdAt ASC` by default.

Search semantics
- `search` should perform case-insensitive partial matches across `username`, `email`, and `phone`.
- Implement DB indexes on these columns for performance.

Pagination semantics
- Use `limit` and `offset` for predictable paging. Return `totalRecords` to calculate pages or rely on `hasNext`.
- For large result sets, prefer cursor-based paging; initially `limit`/`offset` is acceptable.

Security
- Server MUST scope the query to the requesting user's tree. Do not allow passing another user's ID.
- Validate `level` in range [1,13].

Fallback option (no backend change)
- Call existing endpoint: `GET /referrals/me/downlines?depth=13` (requires auth)
- The server returns the entire downline up to depth 13 with each node's absolute `level` (relative to requester) and `user` fields.
- Frontend can filter client-side for nodes where `level === requestedLevel` and then apply client-side pagination and search.

Caveats of fallback
- Potentially large payloads for deep trees (inefficient memory/bandwidth).
- Not suitable for production when deep levels have thousands of users.
- Use only for debugging, QA, or until the backend provides the recommended endpoint.

Frontend UI Guidance
- Dropdown: Level 1..13 (default Level 1)
- Page controls: show current offset/limit, Prev/Next buttons, and jump-to-page if `totalRecords` returned.
- Columns: avatar, username, email, phone, joinDate, status, isDirectReferral badge, actions (view profile)
- Loading state: show skeleton rows while fetching
- Empty state: show "No users found on this level"
- Error handling: show toast for network/permission errors

Performance suggestions
- Debounce search input (300ms)
- Keep `limit` reasonably sized (20–50)
- When backend supports, migrate to cursor-based pagination
- Ensure backend supports server-side filtering and returns `totalRecords` to avoid double queries

TypeScript client types (suggested)
```ts
export interface MatrixLevelUser {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  joinDate: string; // ISO
  status: 'ACTIVE' | 'UNPAID' | 'SUSPENDED' | string;
  isDirectReferral: boolean;
  profilePhotoUrl?: string | null;
}

export interface MatrixLevelResponse {
  status: 'success' | 'error';
  data: {
    levelRequested: number;
    pagination: { totalRecords: number; currentOffset: number; limit: number; hasNext: boolean };
    users: MatrixLevelUser[];
  };
}
```

Example frontend fetch (using fetch API)
```ts
async function fetchLevel(level: number, limit = 20, offset = 0, search?: string) {
  const params = new URLSearchParams({ level: String(level), limit: String(limit), offset: String(offset) });
  if (search) params.set('search', search);
  const res = await fetch(`/referrals/me/levels?${params.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as MatrixLevelResponse;
}
```

QA checklist for frontend
- [ ] Level selector requests correct `level` param
- [ ] Pagination updates offset and requests expected `limit`
- [ ] Search inputs produce filtered results
- [ ] `isDirectReferral` badge appears correctly
- [ ] Large levels still load and paginate (backend-supported)
- [ ] Fallback (downlines fetch + client filter) works for small trees

Recommended backend work items (for dev handoff)
1. Implement `GET /referrals/me/levels` with server-side pagination and search.
2. Return `totalRecords` in response.
3. Add DB indexes for searchable columns.
4. Optionally add cursor-based pagination later for very large datasets.

Related docs/files
- Original plan: docs/Febugs/MATRIX_LEVEL_VIEW_PLAN.md
- Referrals controller: src/modules/referrals/referrals.controller.ts
- Referrals repository: src/modules/referrals/referrals.repository.ts
- Downline DTO: src/modules/referrals/dto/downline-item.dto.ts


---

If you want, I can:
- Add an example React/PrimeNG table component for this API
- Open a small backend PR stub for `GET /referrals/me/levels` implementation
