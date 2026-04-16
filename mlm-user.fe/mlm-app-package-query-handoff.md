# Integration specification: pre-selected membership package via URL path

## 1. Purpose

This document defines the contract between the Segulah marketing website (the `segulah-react` application) and the member-facing MLM web application regarding transmission of a **selected membership package** at the time of redirect from the public pricing section to registration or related flows.

## 2. Scope

The marketing site’s pricing interface redirects users to the MLM application **registration** URL (not the login page). The selected package tier is encoded as the **final path segment** after the registration base path (not as a query string). The MLM application is responsible for reading, validating, and applying that value within its registration or upgrade experience.

## 3. Definitions

| Term | Description |
|------|-------------|
| **Marketing site** | The Segulah landing application that hosts the pricing carousel. |
| **MLM application** | The member web application; redirects target the **register** route by default (e.g. `https://mlm-user-fe.onrender.com/register`). |
| **Package code** | A string identifier for a tier, aligned with the backend field `package` returned by `GET /packages/upgrade-options` (uppercase enumeration). |

## 4. Redirect contract

### 4.1 URL structure

Upon activation of the primary call-to-action on a package card (**Get Started** or **Contact Sales**), the user SHALL be navigated to:

```text
{BASE_URL}/{PACKAGE_CODE}
```

Where:

- **`{BASE_URL}`** — The registration entry path, with no trailing slash before the package segment. Resolved as follows:
  - **Default:** `https://mlm-user-fe.onrender.com/register` (registration area; not `/` or login).
  - **Override:** The marketing build MAY set the environment variable `VITE_MLM_APP_URL` to a fully qualified URL ending at the registration path (e.g. `https://staging.example.com/register`) so that redirects target staging, production, or an alternate register route as required by deployment.
- **`{PACKAGE_CODE}`** — The final **path segment**: the selected tier code, **uppercase**, percent-encoded when necessary, matching the backend enumeration (non-exhaustive examples: `NICKEL`, `SILVER`, `GOLD`, `PLATINUM`, `RUBY`, `DIAMOND`).

The marketing site does **not** send `?package=...` for this flow; the package is carried **in the path** so it is visible “on the URL itself.”

### 4.2 MLM routing expectation

The MLM application SHOULD expose a route that accepts this segment, for example:

- `register/:packageCode`, or
- equivalent static/dynamic routing where the last segment is the tier.

### 4.3 Example requests

| Scenario | Resulting URL |
|----------|----------------|
| User selects Ruby | `https://mlm-user-fe.onrender.com/register/RUBY` |
| User selects Diamond | `https://mlm-user-fe.onrender.com/register/DIAMOND` |

## 5. Requirements for the MLM application

The receiving application SHOULD implement the following behaviors.

1. **Extraction** — On initial load of the **registration** route, read the **path segment** that identifies the package (e.g. React Router `useParams().packageCode`, or split `pathname` after `/register/`).

2. **Validation** — Compare the value against the authoritative list of packages exposed by your backend (or equivalent). Reject or ignore values that are not recognized; do not rely on the segment being present on all entry paths.

3. **Application** — When valid, pre-select the corresponding package in the user interface or advance the user to the appropriate step in the registration or upgrade workflow.

4. **Normalization** — Marketing site values are **uppercase**. If internal logic expects a different casing, normalize once at the boundary (e.g. map to your canonical form after validation).

5. **URL hygiene (recommended)** — After the segment has been consumed and persisted in application state, the application MAY replace the current history entry to a canonical URL without sensitive duplication, if your UX requires it.

## 6. Configuration on the marketing site

Operators MAY set `VITE_MLM_APP_URL` in the marketing site’s environment to change the redirect base without code changes. The value MUST be a valid absolute URL that ends at the **registration path** your app expects (for example `https://mlm-user-fe.onrender.com/register`). The marketing site will append `/{PACKAGE_CODE}` to that path.

## 7. Extensions and change control

Additional query parameters (for example analytics or referral identifiers) or switching back to query-string encoding are **out of scope** for this document unless agreed in writing between the maintainers of the marketing repository and the MLM application, with both codebases updated and released in a coordinated manner.

## 8. Point of contact

For questions regarding this integration, contact the maintainers of the Segulah marketing (`segulah-react`) repository.
