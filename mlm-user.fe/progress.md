# API Integration Progress

| Feature | Endpoint | Status | Date | Notes |
|---------|----------|--------|------|-------|
| Auth Login | `POST /auth/login` | ✅ Completed | 2026-02-18 | Replaced mock with real API, stores accessToken + refreshToken |
| Auth Register | `POST /auth/register` | ✅ Completed | 2026-02-18 | Simplified form: email, password, package, currency, referralCode? |
| Auth Logout | `POST /auth/logout` | ✅ Completed | 2026-02-18 | Sends refreshToken, clears local storage |
| Auth Refresh | `POST /auth/refresh` | ✅ Completed | 2026-02-18 | Interceptor auto-refreshes on 401 |
| Forgot Password | `POST /auth/forgot-password` | ✅ Completed | 2026-02-18 | Wired to API, always shows success for security |
| Reset Password | `POST /auth/reset-password` | ✅ Completed | 2026-02-18 | Reads token from query params |
| User Profile | `GET /users/me` | ✅ Completed | 2026-02-18 | Fetched after login, populates UserService |
| Onboarding Profile | `PUT /users/me` | ✅ Completed | 2026-02-18 | Profile step: firstName, lastName, dateOfBirth, gender, etc. |
| Onboarding Profile Photo | `POST /users/me/photo` | ✅ Completed | 2026-02-18 | Multipart FormData with file |
| Onboarding Identity | `GET /users/me/identity`, `POST /users/me/identity` | ✅ Completed | 2026-02-18 | FormData: idType, idNumber, document, selfie |
| Onboarding Bank | `GET /users/me/bank`, `PUT /users/me/bank` | ✅ Completed | 2026-02-18 | bankName, accountNumber, accountName, accountType |
| Onboarding Preferences | `GET /users/me/preferences`, `PUT /users/me/preferences` | ✅ Completed | 2026-02-18 | preferredLanguage, displayCurrency (NGN \| USD) |
