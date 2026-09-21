export const environment = {
  production: false,
  apiUrl: 'https://api.segulah.ng',
  wsUrl: 'https://api.segulah.ng',
  defaultReferralUsername: 'default',
  /** When true, Legacy Club uses in-memory mocks. Off — live `/legacy/*` APIs. */
  useLegacyClubMocks: false,
  payments: {
    /** Resolved at runtime via window.location.origin when callbackUrl is empty. */
    appUrl: 'https://dashboard-test.segulahglobal-herbal.com',
    callbackUrl: 'https://dashboard-test.segulahglobal-herbal.com/auth/payment/callback',
    providers: {
      paystack: false,
      flutterwave: false,
      korapay: false,
      usdt: true,
    },
  },
};
