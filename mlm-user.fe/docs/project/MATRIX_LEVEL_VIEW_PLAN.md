# Matrix Level Viewer - Backend API Specification

## 1. Feature Overview
The frontend requires a new view under the Matrix section where a user can select a specific matrix level (Level 1 through 13) via a dropdown. Upon selection, the system will display a data table containing the contact and status details of every downline user that exists on that exact level.

Because deeper levels (e.g., Level 5, Level 10) can contain thousands of users, **this endpoint must support server-side pagination and search.**

---

## 2. API Endpoint Definition

### **Fetch Users by Level**
- **Method:** `GET`
- **Endpoint:** `/api/v1/network/levels` *(or your preferred routing equivalent)*
- **Authentication:** Required (Bearer Token) - The backend must infer the requesting user's ID from the token to determine the root of the matrix.

### **Query Parameters**
The endpoint must accept the following URL query parameters:

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `level` | Integer | **Yes** | - | The specific matrix depth to query (1 to 13). Level 1 = direct referrals. |
| `page` | Integer | No | 1 | The current page number for pagination. |
| `limit` | Integer | No | 20 | The number of records to return per page. |
| `search` | String | No | `null` | Optional search string to filter the results by `username`, `email`, or `phone`. |

**Example Request:**
`GET /api/v1/network/levels?level=2&page=1&limit=20&search=johndoe`

---

## 3. Standardized JSON Response Payload

The response must be paginated so the frontend PrimeNG Data Table can accurately render the total number of pages and allow the user to click through them.

**Expected JSON Structure:**
```json
{
  "status": "success",
  "data": {
    "levelRequested": 2,
    "pagination": {
      "totalRecords": 150,     // Total number of users on this specific level
      "currentPage": 1,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "john_doe99",
        "email": "johndoe@example.com",
        "phone": "+2348012345678",
        "joinDate": "2026-05-01T14:30:00Z",
        "status": "ACTIVE"         // e.g., 'ACTIVE', 'UNPAID', 'SUSPENDED'
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655441111",
        "username": "sarah_smith",
        "email": "sarah@example.com",
        "phone": "+2348098765432",
        "joinDate": "2026-05-02T09:15:00Z",
        "status": "UNPAID"
      }
    ]
  }
}
```

## 4. Notes for Backend Team
1. **Performance:** Calculating deep levels on the fly can be database-intensive depending on the tree structure (e.g., Adjacency List vs Nested Sets vs Closure Table). Please ensure database indexes are optimized for depth queries.
2. **Security:** Ensure that the authenticated user can ONLY query levels relating to their own downline tree, and cannot pass another user's ID to view their network.
