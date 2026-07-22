export const environment = {
  production: false,
  apiUrl: 'https://api.segulah.ng',
  wsUrl: 'https://api.segulah.ng',
  defaultReferralUsername: 'default',
  payments: {
    /** Resolved at runtime via window.location.origin when callbackUrl is empty. */
    appUrl: 'https://dashboard-test.segulahglobal-herbal.com',
    callbackUrl: 'https://dashboard-test.segulahglobal-herbal.com/auth/payment/callback',
    providers: {
      paystack: false,
      flutterwave: true,
      korapay: false,
      usdt: true,
    },
  },
};
