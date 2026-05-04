# Real-Time Notifications Integration Plan

## 1. Overview & Objective
The goal is to implement a global "Toast" notification system on the frontend that alerts the user instantly when key events occur (e.g., new earnings, new likes/referrals). 

To ensure users never miss an alert—even if they were offline when it happened—the architecture relies on a **Hybrid Approach: REST API (Catch-Up) + WebSockets (Live Feed)**.

## 2. The Hybrid Architecture Flow

### Phase A: The "Catch-Up" (REST)
WebSockets only deliver messages to actively connected clients. Therefore, the moment a user logs in (or refreshes the page), the frontend must fetch missed notifications.
1. Frontend calls a REST endpoint to retrieve unread notifications.
2. Frontend displays them as Toast popups.
3. Frontend immediately calls another REST endpoint to mark those specific notifications as "read" so they do not show up on the next refresh.

### Phase B: The "Live Feed" (WebSocket)
Simultaneously upon login, the frontend establishes a secure WebSocket connection.
1. The backend pushes new events down the socket the exact moment they are saved in the database.
2. The frontend intercepts these events and instantly triggers a Toast popup.

---

## 3. Backend Requirements & Specifications

### 3.1 REST API Endpoints Required

**1. Fetch Unread Notifications**
- **Endpoint:** `GET /api/v1/notifications?status=unread`
- **Purpose:** Retrieves missed alerts for the authenticated user.
- **Response Shape:** Array of standard Notification Objects (see payload structure below).

**2. Mark Notifications as Read**
- **Endpoint:** `PUT /api/v1/notifications/mark-read`
- **Payload:** `{ "notificationIds": ["uuid-1", "uuid-2"] }`
- **Purpose:** Updates the database so these alerts are not fetched again during the next "Catch-Up" phase.

### 3.2 WebSocket Connection Protocol
The frontend is built in Angular. Please confirm which underlying WebSocket technology the backend will expose so the frontend can install the appropriate client library:
- [ ] SignalR (.NET)
- [ ] Socket.io (Node)
- [ ] Raw WebSockets (Native / ActionCable / Gorilla)

### 3.3 Connection Authentication
The socket connection MUST be authenticated to prevent unauthorized access and to ensure users only receive their own alerts.
- **Preferred Method:** The frontend will pass the standard JWT Bearer token during the initial connection handshake. 
- *Note:* If using SignalR/Socket.io, this is typically passed via the `access_token` query parameter or an auth header. Please configure the WebSocket server to decode this token and securely map the connection session to the specific User ID.

### 3.4 WebSocket Event Names
To standardize the integration, the backend should emit a strongly-typed event name that the frontend will listen for.
- **Recommended Event Name:** `ReceiveNotification`

### 3.5 Standardized JSON Payload Structure
Whether the notification is arriving via the REST "Catch-Up" call or being pushed via the WebSocket "Live Feed", the JSON payload structure must be identical. 

**Required JSON Structure:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "type": "EARNING",          // Enum: 'EARNING', 'LIKE', 'SYSTEM'
  "title": "New Earning!",
  "message": "You just earned $50.00 from your direct successline.",
  "amount": 50.00,            // Optional depending on type
  "currency": "USD",          // Optional depending on type
  "isRead": false,
  "createdAt": "2026-05-04T09:30:00Z"
}
```

## 4. Frontend Action Items (For Context)
Once the backend implements the above:
1. Frontend will build a `RealTimeConnectionService` to manage connection, auto-reconnection, and JWT injection.
2. Frontend will map the `ReceiveNotification` socket event to the global PrimeNG `MessageService` to trigger the UI Toasts.
3. Frontend will implement the `ngOnInit` hook in the Dashboard layout to execute the REST Catch-Up flow.
