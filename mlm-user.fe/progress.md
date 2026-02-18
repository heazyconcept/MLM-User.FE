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
