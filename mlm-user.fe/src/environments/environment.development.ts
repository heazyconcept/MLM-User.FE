export const environment = {
  production: false,
  apiUrl: 'https://api.segulah.ng',
  wsUrl: 'https://api.segulah.ng',
  defaultReferralUsername: 'default',
  payments: {
    /** Resolved at runtime via window.location.origin when callbackUrl is empty. */
    appUrl: '',
    callbackUrl: '',
    providers: {
      paystack: false,
      flutterwave: true,
      usdt: true,
    },
  },
};
