# MLM User Frontend

Angular 21 SPA for an MLM platform. Users register, activate (Paystack or wallet), complete onboarding, and access dashboard, wallet, network, earnings, marketplace, orders, and settings.

**See [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md)** for project scope, implementation status, and developer onboarding.

### Implementation Status (Summary)

| Area | Status |
|------|--------|
| Auth, registration, activation (Paystack + wallet) | ✅ Integrated |
| Onboarding, profile, dashboard | ✅ Integrated |
| Wallet, network, earnings | ✅ Integrated |
| Withdrawals, marketplace, orders, notifications | ⚠️ UI ready; API integration varies |

---

## Environment

- **Local:** Edit `src/environments/environment.ts` and `environment.development.ts` and set `apiUrl` (and `defaultReferralCode` if needed). You can keep values in `.env` for reference; the app reads from the environment files.
- **Render:** Set `API_URL` and optionally `DEFAULT_REFERRAL_CODE` in the Render dashboard (Environment). To inject them into the app at build time, set the build command to run a quick step before `ng build`, for example:
  `node -e "const e=process.env; require('fs').writeFileSync('src/environments/environment.ts', 'export const environment = { production: true, apiUrl: \\'' + (e.API_URL||'').replace(/'/g, \"\\\\'\") + '\\', defaultReferralCode: \\'' + (e.DEFAULT_REFERRAL_CODE||'REF000000') + '\\' };');" && npm run build`

Never commit real API URLs; use placeholders or empty strings in the committed env files.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
