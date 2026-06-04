# Merchant Profile Update Feature - API & Frontend Requirements

## Overview
Currently, the merchant registration flow supports applying to become a merchant with details like `type`, `serviceAreas`, `businessName`, and `phoneNumber` (via `POST /merchants/apply`). However, there is no existing API endpoint in the backend system to **update** these merchant profile details after approval, nor is there a field for the physical **address** (pickup/store location) in the merchant profile database schema. 

This document details the API gaps, proposed specifications for the backend team, and a blueprint for the frontend components once the API is available.

---

## 1. Current API Gap Analysis

### 1.1 Read Profile vs Update Profile
- **Retrieving profile details:** `GET /merchants/me` retrieves the merchant profile.
- **Updating profile details:** `PATCH /merchants/me` updates business name, phone, address, and service areas (implemented).
- **User profile update endpoint:** The `PUT /users/me` endpoint allows modifying user account fields (such as `firstName`, `lastName`, `phone`, `address`), but these do not propagate to the merchant profile's distinct fields (like `businessName`, merchant-specific `phoneNumber`, or merchant `serviceAreas`).

### 1.2 Missing Merchant Address Field
- In the existing API spec (`MERCHANTS_API.md`), the merchant profile does not support an `address` field.
- Because merchants are responsible for order fulfillments (including `PICKUP` and `OFFLINE_DELIVERY`), they must have a distinct, physical store/pickup address where customers or logistics partners can pick up items. Currently, the system lacks this field in the merchant context.

---

## 2. Proposed API Contract

To enable profile updates, the backend must expose a new endpoint:

### 2.1 Update Merchant Profile (`PATCH /merchants/me`)
- **Method:** `PATCH` (or `PUT`)
- **Path:** `/merchants/me`
- **Auth:** Bearer Token (User must have role `MERCHANT` and the merchant profile status must be `ACTIVE` — enforced via `MerchantGuard`).
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

#### Request Body (JSON)
All fields should be optional, permitting partial updates:
```json
{
  "businessName": "Segulah Herbal Hub",
  "phoneNumber": "+2348011223344",
  "address": "45 Segulah Way, Ikeja, Lagos",
  "serviceAreas": ["Lagos", "Abuja", "Kano"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `businessName` | string | No | The registered business name for the merchant |
| `phoneNumber` | string | No | Merchant contact number (for order inquiries) |
| `address` | string | No | **[NEW FIELD]** The physical store/warehouse pickup address |
| `serviceAreas` | string[] | No | Regions/cities where the merchant offers delivery |

#### Response (200 OK)
Returns the updated merchant profile:
```json
{
  "id": "merchant-uuid",
  "userId": "user-uuid",
  "businessName": "Segulah Herbal Hub",
  "phoneNumber": "+2348011223344",
  "address": "45 Segulah Way, Ikeja, Lagos",
  "type": "REGIONAL",
  "status": "ACTIVE",
  "serviceAreas": ["Lagos", "Abuja", "Kano"],
  "createdAt": "2026-03-04T10:00:00.000Z",
  "updatedAt": "2026-06-02T11:35:32.000Z"
}
```

#### Error Codes
- **400 Bad Request:** If payload is invalid (e.g. `serviceAreas` is empty, or invalid formatting).
- **401 Unauthorized:** Missing or invalid Bearer token.
- **403 Forbidden:** User is not a merchant, or the merchant status is not `ACTIVE`.
- **404 Not Found:** Merchant profile not found for this user.

---

## 3. Proposed Frontend Implementation Blueprint

Once the backend endpoint is implemented, the frontend can be updated in the following steps:

### 3.1 Update the Types & Interfaces
Update `MerchantProfile` and `MerchantProfileResponse` in [merchant.service.ts](file:///c:/Users/HP/OneDrive/Documents/MLM-User.FE/mlm-user.fe/src/app/services/merchant.service.ts):

```typescript
export interface MerchantProfile {
  id: string;
  userId: string;
  businessName?: string;
  phoneNumber?: string;
  address?: string; // Add this field
  type: MerchantType;
  status: MerchantStatus;
  serviceAreas: string[];
  createdAt: string;
  updatedAt?: string;
}
```

### 3.2 Add Update Method in `MerchantService`
Add the following update method to [MerchantService](file:///c:/Users/HP/OneDrive/Documents/MLM-User.FE/mlm-user.fe/src/app/services/merchant.service.ts):

```typescript
export interface UpdateMerchantProfileBody {
  businessName?: string;
  phoneNumber?: string;
  address?: string;
  serviceAreas?: string[];
}

// Inside MerchantService class:
updateProfile(body: UpdateMerchantProfileBody): Observable<MerchantProfileResponse | null> {
  this.actionLoadingSignal.set(true);
  this.errorSignal.set(null);
  return this.api.patch<MerchantProfileResponse>('merchants/me', body).pipe(
    tap((updatedProfile) => {
      if (updatedProfile && !updatedProfile.message) {
        this.profileSignal.set(updatedProfile);
      }
    }),
    catchError((err) => {
      console.error('[MerchantService] updateProfile failed', err);
      this.errorSignal.set(err?.error?.message || 'Failed to update merchant profile.');
      return of(null);
    }),
    finalize(() => this.actionLoadingSignal.set(false)),
  );
}
```

### 3.3 Create a "Merchant Settings / Edit Profile" Form
Implement a settings component (e.g. `merchant-settings.component.ts`) inside `src/app/pages/merchant/` with a simple edit form:

- **Inputs:** Text fields for `businessName`, `phoneNumber`, `address`, and a chip-based/comma-separated input for `serviceAreas`.
- **Validation:** Ensure fields match basic format rules (e.g., non-empty fields, valid phone formats).
- **Actions:** A "Save Changes" button that calls `updateProfile()`, displays a success toast/message, and updates the local profile signal automatically.
- **Styling:** Align with standard Tailwind CSS and PrimeNG layout styling (card panels, clean borders, glassmorphism shadows, and smooth transitions).
