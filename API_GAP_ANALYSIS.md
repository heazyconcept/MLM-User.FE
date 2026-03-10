# API Gap Analysis: UI vs API Endpoints

**Date:** February 16, 2026  
**Purpose:** Identify UI features that exist but lack corresponding API endpoints

---

## Summary

This document compares the implemented UI features with the available API endpoints documented in `API.md`. It identifies gaps where UI functionality exists but API support is missing or incomplete.

---

## 1. Onboarding Flow

### 1.1 Profile Information (`/onboarding/profile`)
**UI Features:**
- Profile photo upload
- First name, last name
- Username (read-only after set)
- Date of birth
- Gender (optional)

**API Status:** ⚠️ **PARTIAL**
- `PUT /users/me` exists but may not support:
  - Profile photo upload
  - Date of birth
  - Gender
  - Username management

**Gap:** Profile photo upload, DOB, gender fields not documented in API

---

### 1.2 Contact Details (`/onboarding/contact`)
**UI Features:**
- Email (read-only)
- Phone number
- Address
- City
- State
- Country

**API Status:** ⚠️ **PARTIAL**
- `PUT /users/me` supports `phone?` but not:
  - Full address fields (address, city, state, country)

**Gap:** Address fields (address, city, state, country) not in API

---

### 1.3 Identity / KYC (`/onboarding/identity`)
**UI Features:**
- ID Type dropdown (National ID, Passport, Driver's License)
- ID Number
- ID Document upload
- Selfie upload

**API Status:** ❌ **MISSING**
- No endpoint for KYC document submission
- No endpoint for identity verification

**Gap:** Complete KYC/identity verification endpoints missing

---

### 1.4 Bank Details (`/onboarding/bank`)
**UI Features:**
- Bank name
- Account number
- Account name
- Account type

**API Status:** ❌ **MISSING**
- No endpoint for bank details management
- No endpoint to store/update bank information

**Gap:** Bank details management endpoints missing

---

### 1.5 Preferences (`/onboarding/preferences`)
**UI Features:**
- Preferred language
- Display currency (USD/NGN)
- Notification preferences (checkboxes)

**API Status:** ❌ **MISSING**
- No endpoint for user preferences
- No endpoint for language/currency preferences

**Gap:** User preferences endpoints missing

---

## 2. Settings Pages

### 2.1 Account Settings (`/settings/account`)
**UI Features:**
- Profile photo upload/update
- Name fields (first name, last name)
- Username (read-only)
- Email (read-only)

**API Status:** ⚠️ **PARTIAL**
- `PUT /users/me` exists but may not support:
  - Profile photo upload
  - Username display/management

**Gap:** Profile photo upload not documented in API

---

### 2.2 Security Settings (`/settings/security`)
**UI Features:**
- Change password form
- Password rules info

**API Status:** ✅ **COVERED**
- `PUT /users/me/password` exists with `currentPassword` and `newPassword`

**Gap:** None

---

### 2.3 Preferences (`/settings/preferences`)
**UI Features:**
- Language selector
- Display currency (read-only)
- Notification preferences
- Theme toggle (if supported)

**API Status:** ❌ **MISSING**
- No endpoint for app preferences
- No endpoint for language/theme settings

**Gap:** User preferences endpoints missing

---

### 2.4 Active Sessions (`/settings/sessions`)
**UI Features:**
- Active session list
- Device info
- Location info
- Last active timestamp
- Logout session button
- Logout all sessions button

**API Status:** ❌ **MISSING**
- No endpoint to list active sessions
- No endpoint to revoke individual sessions
- No endpoint to revoke all sessions

**Gap:** Session management endpoints missing

---

## 3. Notifications

### 3.1 Notification Preferences (`/notifications/preferences`)
**UI Features:**
- Toggle notification channels (IN_APP, EMAIL, SMS, PUSH)
- Toggle notification types (USER_REGISTERED, PAYMENT_INITIATED, etc.)
- Per-category preferences

**API Status:** ❌ **MISSING**
- `GET /notifications` exists for listing notifications
- `PUT /notifications/:id/read` exists for marking as read
- `PUT /notifications/read-all` exists for marking all as read
- **BUT:** No endpoint for managing notification preferences

**Gap:** Notification preferences management endpoints missing

---

## 4. Merchant Features

### 4.1 Merchant Inventory (`/merchant/inventory`)
**UI Features:**
- List products assigned to merchant
- View stock quantity
- View stock status (In Stock, Low, Out)
- Edit stock quantity
- Update stock status

**API Status:** ❌ **MISSING**
- `GET /admin/merchants/:id/products` exists (admin only)
- `POST /admin/merchants/:id/products` exists (admin assigns products)
- `DELETE /admin/merchants/:id/products/:productId` exists (admin removes products)
- **BUT:** No endpoint for merchants to:
  - View their own inventory
  - Update their own stock quantities
  - Manage their own inventory status

**Gap:** Merchant inventory management endpoints missing

---

## 5. Profile Page

### 5.1 Top-Level Profile (`/profile`)
**UI Features:**
- View/edit profile information
- Display user details

**API Status:** ✅ **COVERED**
- `GET /users/me` exists
- `PUT /users/me` exists

**Gap:** None (assuming PUT /users/me supports all profile fields)

---

## 6. Additional Observations

### 6.1 User Upgrade Options
**UI:** May display upgrade options  
**API:** ✅ `GET /users/me/upgrade-options` exists

**Gap:** None

---

### 6.2 Referral Code Validation
**UI:** Validates referral code during registration  
**API:** ✅ `POST /referrals/validate` exists

**Gap:** None

---

## Summary Table

| Feature Category | UI Route | API Status | Gap Severity |
|-----------------|----------|------------|--------------|
| **Onboarding - Profile** | `/onboarding/profile` | ⚠️ Partial | Medium |
| **Onboarding - Contact** | `/onboarding/contact` | ⚠️ Partial | Medium |
| **Onboarding - Identity/KYC** | `/onboarding/identity` | ❌ Missing | **High** |
| **Onboarding - Bank** | `/onboarding/bank` | ❌ Missing | **High** |
| **Onboarding - Preferences** | `/onboarding/preferences` | ❌ Missing | Medium |
| **Settings - Account** | `/settings/account` | ⚠️ Partial | Low |
| **Settings - Security** | `/settings/security` | ✅ Covered | None |
| **Settings - Preferences** | `/settings/preferences` | ❌ Missing | Medium |
| **Settings - Sessions** | `/settings/sessions` | ❌ Missing | **High** |
| **Notifications - Preferences** | `/notifications/preferences` | ❌ Missing | Medium |
| **Merchant - Inventory** | `/merchant/inventory` | ❌ Missing | **High** |
| **Profile** | `/profile` | ✅ Covered | None |

---

## Priority Recommendations

### 🔴 **High Priority** (Critical for core functionality)

1. **KYC/Identity Verification Endpoints**
   - `POST /users/me/identity` - Submit identity documents
   - `GET /users/me/identity` - Get identity verification status
   - Support for: ID type, ID number, document uploads, selfie upload

2. **Bank Details Endpoints**
   - `POST /users/me/bank` - Add/update bank details
   - `GET /users/me/bank` - Get bank details
   - Support for: bank name, account number, account name, account type

3. **Session Management Endpoints**
   - `GET /users/me/sessions` - List active sessions
   - `DELETE /users/me/sessions/:id` - Revoke specific session
   - `DELETE /users/me/sessions` - Revoke all sessions

4. **Merchant Inventory Endpoints**
   - `GET /merchants/inventory` - Get merchant's inventory (MerchantGuard)
   - `PUT /merchants/inventory/:productId/stock` - Update stock quantity (MerchantGuard)
   - `GET /merchants/inventory/:productId` - Get product inventory details

### 🟡 **Medium Priority** (Important for user experience)

5. **User Preferences Endpoints**
   - `GET /users/me/preferences` - Get user preferences
   - `PUT /users/me/preferences` - Update preferences
   - Support for: language, display currency, theme, notification preferences

6. **Notification Preferences Endpoints**
   - `GET /notifications/preferences` - Get notification preferences
   - `PUT /notifications/preferences` - Update notification preferences
   - Support for: channel preferences (IN_APP, EMAIL, SMS, PUSH), type preferences

7. **Profile Photo Upload**
   - Extend `PUT /users/me` to support profile photo upload
   - Or add `POST /users/me/photo` for photo upload

### 🟢 **Low Priority** (Nice to have)

8. **Extended Profile Fields**
   - Ensure `PUT /users/me` supports: date of birth, gender, full address (address, city, state, country)
   - Or document these fields if they're already supported

---


## Next Steps

1. **Verify with Backend Team:**
   - Check if any of these endpoints exist but aren't documented
   - Confirm planned implementation timeline

2. **Prioritize Implementation:**
   - Focus on High Priority items first
   - Align with business requirements and user flows

3. **Update API Documentation:**
   - Once endpoints are implemented, update `API.md`
   - Include request/response schemas

4. **Frontend Integration:**
   - Replace mock data with API calls once endpoints are available
   - Handle loading states and error scenarios
