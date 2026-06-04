# Frontend Integration: Admin Dashboard Notification Popups

Date: 2026-05-28

Admin-managed announcements with optional images and a configurable display window. Users see them as **dashboard modals** (not toasts). Dismissal is **session-only** — popups return on the next browser session until `endsAt`.

---

## API summary

### Admin (Bearer, `Role.ADMIN`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/notifications/announcements` | List campaigns (`status`, `limit`, `offset`) |
| `GET` | `/admin/notifications/announcements/:id` | Campaign detail |
| `POST` | `/admin/notifications/announcements` | Create + publish (`multipart/form-data`) |
| `PATCH` | `/admin/notifications/announcements/:id/archive` | Stop showing popups |
| `POST` | `/admin/notifications/broadcast` | Legacy JSON broadcast (delegates to campaigns; default `displayDays: 7`) |

### User (Bearer)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/notifications/dashboard-popups` | Active modals for current user |

---

## A. Admin dashboard

### Notifications menu

1. **List** — `GET /admin/notifications/announcements?limit=20&offset=0`  
   Optional `status`: `DRAFT` | `PUBLISHED` | `ARCHIVED`.

2. **Create** — `POST /admin/notifications/announcements` as `multipart/form-data`:

| Field | Required | Notes |
|-------|----------|--------|
| `title` | yes | min 3 chars |
| `message` | yes | min 10 chars |
| `displayDays` | yes | 1–365 |
| `targetRoles` | no | Repeat field or array; empty = all roles |
| `targetPackages` | no | Empty = all packages |
| `images` | no | Up to 5 files, jpeg/png/webp, 5 MB each |

3. **Archive** — `PATCH /admin/notifications/announcements/{id}/archive`

### Create response (`201`)

```json
{
  "announcementId": "uuid",
  "recipientCount": 1200,
  "announcement": {
    "id": "uuid",
    "title": "Holiday promo",
    "message": "Full message body…",
    "imageUrls": ["https://…/announcements/uuid/abc.webp"],
    "displayDays": 7,
    "publishedAt": "2026-05-28T10:00:00.000Z",
    "endsAt": "2026-06-04T10:00:00.000Z",
    "status": "PUBLISHED",
    "targetRoles": [],
    "targetPackages": [],
    "recipientCount": 1200,
    "createdByAdminId": "uuid",
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

### Example (fetch)

```typescript
const form = new FormData();
form.append('title', 'System maintenance');
form.append('message', 'The platform will be down Sunday 2am–4am WAT.');
form.append('displayDays', '3');
files.forEach((f) => form.append('images', f));

await fetch(`${API}/admin/notifications/announcements`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${adminToken}` },
  body: form,
});
```

---

## B. User dashboard — modal queue

On authenticated dashboard layout init:

1. `GET /notifications/dashboard-popups`
2. Read `sessionStorage` key `segulah_dashboard_popup_dismissed` (JSON string array of announcement IDs).
3. Show modals for popups not in that list, **oldest `publishedAt` first**.
4. On close / “Got it”, append `id` to sessionStorage (no API call).
5. New tab/session → modals show again until server `endsAt`.

### Popup response

```json
{
  "popups": [
    {
      "id": "uuid",
      "title": "Welcome",
      "message": "…",
      "imageUrls": ["https://…"],
      "publishedAt": "2026-05-28T10:00:00.000Z",
      "endsAt": "2026-06-04T10:00:00.000Z"
    }
  ]
}
```

### UI notes

- Use a **modal/dialog**, not the toast component.
- If `imageUrls.length > 1`, use a carousel.
- If `imageUrls` is empty, show text-only modal.
- Trust `endsAt` from the API; hide locally if `Date.now() > new Date(endsAt)`.

### Session dismiss helper

```typescript
const STORAGE_KEY = 'segulah_dashboard_popup_dismissed';

function getDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function dismissPopup(id: string): void {
  const next = [...new Set([...getDismissed(), id])];
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
```

---

## C. Toasts and inbox (coexistence)

Campaigns still create per-user `SYSTEM_ANNOUNCEMENT` inbox rows and may push `ReceiveNotification` on WebSocket.

**Skip toast** when `metadata.popup === true` (or when `imageUrls` is present on the wire payload):

```typescript
socket.on('ReceiveNotification', (payload) => {
  if (payload.metadata?.popup === true) return;
  messageService.add({ severity: 'info', summary: payload.title, detail: payload.message });
});
```

Catch-up: `GET /notifications?status=unread&toastSafe=true` — filter out `metadata.popup === true` the same way if needed.

---

## D. Legacy broadcast

`POST /admin/notifications/broadcast` (JSON body) still works:

```json
{
  "title": "Notice",
  "message": "Short system notice text here.",
  "displayDays": 7,
  "targetRoles": ["USER"],
  "targetPackages": []
}
```

Response: `{ "count": 1200, "announcementId": "uuid" }`.

Prefer the multipart announcements endpoint when images are required.

---

## E. Errors

| HTTP | When |
|------|------|
| `400` | Invalid `displayDays`, too many/large images, R2 not configured |
| `403` | Non-admin |
| `404` | Unknown announcement id |

---

## F. Configuration

Uses existing Cloudflare R2 env vars (`CLOUDFLARE_R2_*`) — same as product images. Ensure `FRONTEND_ORIGIN` includes admin and user app origins for API and WebSocket CORS.
