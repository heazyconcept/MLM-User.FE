# 02-onboarding-profile-setup

<a id="02-onboarding-profile-setupmd"></a>

# 02-onboarding-profile-setup.md

**User Interface Specification – Onboarding & Profile Setup**

* * *

<a id="1-purpose"></a>

## 1\. Purpose

This document defines the **User Onboarding & Profile Setup UI**.

It covers:

- First-time onboarding flow after registration
- Ongoing profile management
- Client-side validation
- UI behavior and navigation

> ⚠️ UI-only specification  
> No backend integration, no persistence, no KYC verification logic

* * *

<a id="2-scope"></a>

## 2\. Scope

<a id="included"></a>

### Included

- Profile information
- Contact details
- Identity (KYC – UI only)
- Bank details
- Preferences

<a id="excluded"></a>

### Excluded

- Admin profile management
- Compliance verification
- Wallet creation logic
- Withdrawal validation

* * *

<a id="3-entry-points"></a>

## 3\. Entry Points

| Trigger | Route |
| --- | --- |
| After verification | `/onboarding/profile` |
| From settings | `/settings/profile` |

* * *

<a id="4-onboarding-flow-overview"></a>

## 4\. Onboarding Flow Overview

```
Profile Info
   ↓
Contact Details
   ↓
Identity (KYC)
   ↓
Bank Details
   ↓
Preferences
   ↓
Dashboard

```

- Steps are **linear during onboarding**
- Steps are **individually accessible** after onboarding

* * *

<a id="5-profile-information"></a>

## 5\. Profile Information

<a id="route"></a>

### Route

```
/onboarding/profile

```

<a id="ui-components"></a>

### UI Components

- Profile Photo Upload
- First Name
- Last Name
- Username (read-only after set)
- Date of Birth
- Gender (optional)
- Continue button

<a id="validation-rules"></a>

### Validation Rules

| Field | Rule |
| --- | --- |
| First Name | Required |
| Last Name | Required |
| Username | Required |
| Date of Birth | Required |
| Photo | Optional |

<a id="button-behavior"></a>

### Button Behavior

- Validate inputs
- Show loading (1s)
- Navigate → `/onboarding/contact`

* * *

<a id="6-contact-details"></a>

## 6\. Contact Details

<a id="route"></a>

### Route

```
/onboarding/contact

```

<a id="ui-components"></a>

### UI Components

- Email (read-only)
- Phone Number
- Address
- City
- State
- Country
- Continue button
- Back button

<a id="validation"></a>

### Validation

| Field | Rule |
| --- | --- |
| Phone | Required |
| Address | Required |
| Country | Required |

* * *

<a id="7-identity-kyc-ui-only"></a>

## 7\. Identity (KYC – UI Only)

<a id="route"></a>

### Route

```
/onboarding/identity

```

<a id="ui-components"></a>

### UI Components

- ID Type dropdown
  - National ID
  - Passport
  - Driver’s License
- ID Number
- ID Upload
- Selfie Upload
- Continue button

<a id="validation"></a>

### Validation

| Field | Rule |
| --- | --- |
| ID Type | Required |
| ID Number | Required |
| Uploads | Required |

> ⚠️ No verification logic performed  
> Files are accepted visually only

* * *

<a id="8-bank-details"></a>

## 8\. Bank Details

<a id="route"></a>

### Route

```
/onboarding/bank

```

<a id="ui-components"></a>

### UI Components

- Bank Name
- Account Number
- Account Name
- Account Type
- Continue button
- Skip button

<a id="validation"></a>

### Validation

| Field | Rule |
| --- | --- |
| Bank Name | Required |
| Account Number | Numeric, 10 digits |
| Account Name | Required |

<a id="behavior"></a>

### Behavior

- Skip allowed
- Incomplete state allowed

* * *

<a id="9-preferences"></a>

## 9\. Preferences

<a id="route"></a>

### Route

```
/onboarding/preferences

```

<a id="ui-components"></a>

### UI Components

- Preferred Language
- Display Currency (USD / NGN)
- Notification Preferences (checkboxes)
- Finish button

<a id="validation"></a>

### Validation

- No required fields

<a id="button-behavior"></a>

### Button Behavior

- Save preferences (mock)
- Redirect → `/dashboard`

* * *

<a id="10-post-onboarding-profile-management"></a>

## 10\. Post-Onboarding Profile Management

<a id="route"></a>

### Route

```
/settings/profile

```

<a id="sections"></a>

### Sections

- Profile Info
- Contact Details
- Identity
- Bank Details
- Preferences

Each section:

- Editable independently
- Save button per section
- Inline success feedback

* * *

<a id="11-reusable-components"></a>

## 11\. Reusable Components

- `AvatarUpload`
- `TextInput`
- `Select`
- `FileUpload`
- `CheckboxGroup`
- `Button`
- `Stepper`
- `Toast`

* * *

<a id="12-state-management-mock"></a>

## 12\. State Management (Mock)

```
profile: {
  personalInfo: {}
  contactInfo: {}
  identityInfo: {}
  bankInfo: {}
  preferences: {}
}

```

* * *

<a id="13-ux-accessibility-rules"></a>

## 13\. UX & Accessibility Rules

- Step indicator visible during onboarding
- Back navigation supported
- Save progress locally
- Inline validation messages
- File upload previews

* * *

<a id="14-ui-flow-summary"></a>

## 14\. UI Flow Summary

```
Verification
   → Onboarding
       → Profile
       → Contact
       → Identity
       → Bank
       → Preferences
   → Dashboard

```

* * *

<a id="15-future-backend-integration-notes"></a>

## 15\. Future Backend Integration Notes

When backend is introduced:

- Persist profile data
- Validate identity documents
- Enforce withdrawal eligibility
- Lock verified fields

* * *

<a id="16-status"></a>

## 16\. Status

✅ UI-complete  
✅ Onboarding & settings-ready  
✅ Safe for frontend development