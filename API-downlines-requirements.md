# API Requirement: `GET /referrals/me/downlines` — Response Schema

## Summary

The frontend's **Downline List** page (`/network/downlines`) calls `GET /referrals/me/downlines` to display a table of team members. The current OpenAPI spec defines **no response schema** for this endpoint. This document specifies the exact response format the frontend expects.

## Endpoint

```
GET /referrals/me/downlines?depth={number}
Authorization: Bearer <token>
```

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `depth` | number | No | Max depth/levels of downlines to return (e.g., `2` for first 2 levels) |

## Expected Response

The frontend handles multiple response shapes (array directly, or wrapped in `data`/`items`/`downlines`). The **recommended** format is a plain JSON array:

```json
[
  {
    "id": "string (required)",
    "username": "string (required — display name in table)",
    "firstName": "string (required — for full name)",
    "lastName": "string (required — for full name)",
    "email": "string (fallback for username if username is missing)",
    "level": 1,
    "package": "SILVER | GOLD | PLATINUM | RUBY | DIAMOND",
    "status": "active | inactive",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z (ISO 8601)",
    "directReferrals": 5,
    "teamSize": 12
  }
]
```

## Field Mapping (Frontend ← Backend)

Below is exactly how the frontend maps each API response field. The frontend tries **multiple field names** (listed in priority order) to handle camelCase/snake_case differences:

| Frontend Field | API Fields (priority order) | Type | Required | Description |
|----------------|---------------------------|------|----------|-------------|
| `id` | `id`, `userId`, `user_id` | string | ✅ | Unique user identifier |
| `username` | `username`, `email`, `referralCode`, `referral_code` | string | ✅ | Display name in table |
| `fullName` | Built from `firstName`+`lastName`, or `fullName`, `name`, `email` | string | ✅ | Shown under username |
| `joinDate` | `joinedAt`, `createdAt`, `registeredAt`, `created_at` | ISO date string | ✅ | When user registered |
| `status` | Derived from `isActive`, `is_active`, or `status` != 'inactive' | 'active' \| 'inactive' | ✅ | Active/inactive badge |
| `level` | `level`, `depth` | number | ✅ | Downline depth (1 = direct, 2 = second level, etc.) |
| `package` | `package`, or `registration.package` | string | ✅ | Membership package |
| `totalDirects` | `directReferrals`, `direct_referrals`, `directReferralsCount` | number | ⚠️ | How many directs this member has |
| `teamSize` | `teamSize`, `team_size`, `downlineCount`, `downline_count` | number | ⚠️ | Total team size under this member |

> ⚠️ = Currently **missing** from the API response (shows as `0` in the UI)

## What's Currently Missing from the API

Based on testing, the API likely returns only basic user info. The following fields are **needed by the frontend** but may not be present in the response:

### 1. `level` / `depth` (Critical)
The downline's depth in the network tree. Without this:
- Level filter doesn't work
- Matrix tree visualization is broken
- All members show as "Level 1"

### 2. `directReferrals` / `directReferralsCount`
How many direct referrals this downline member has. Without this, the "DR" stat column shows `0` for everyone.

### 3. `teamSize` / `downlineCount`
Total number of people under this downline member. Without this, the "Team" stat column shows `0` for everyone.

### 4. `package`
The member's registration package (SILVER, GOLD, etc.). Without this, the package badge shows "—" for everyone.

### 5. `isActive` / `status`
The member's active status. Without this, the status badge may show incorrect info.

### 6. `firstName` / `lastName`
First and last name for display. Without these, the full name shows as email or "—".

## Ideal Response Schema (NestJS DTO)

```typescript
// Suggested DTO for the downline response
class DownlineItemDto {
  @ApiProperty({ example: 'uuid-string' })
  id: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 1, description: 'Depth in the network tree (1 = direct referral)' })
  level: number;

  @ApiProperty({ enum: ['SILVER', 'GOLD', 'PLATINUM', 'RUBY', 'DIAMOND'] })
  package: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: 5, description: 'Number of direct referrals this user has' })
  directReferrals: number;

  @ApiProperty({ example: 12, description: 'Total team size (all levels) under this user' })
  teamSize: number;
}
```

## OpenAPI Spec Fix Needed

The endpoint in the Swagger spec needs:
1. **Response schema** — Currently empty (`"200": { "description": "" }`)
2. **Query parameter** — `depth` parameter is not documented in the spec
3. **Add `@ApiResponse()` decorator** with the array of `DownlineItemDto`

## Frontend Status

The frontend code already handles missing fields gracefully with fallbacks. No frontend changes are needed — once the backend returns the fields listed above, they will automatically appear in the UI.
