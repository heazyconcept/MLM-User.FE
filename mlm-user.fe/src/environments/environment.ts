export const environment = {
  production: true,
  apiUrl: 'https://api.segulahglobal-herbal.com',
  wsUrl: 'https://api.segulahglobal-herbal.com',
  defaultReferralUsername: 'default',
  /** Flip to false once Legacy Club backend endpoints are live. */
  useLegacyClubMocks: false,
  payments: {
    appUrl: 'https://dashboard.segulahglobal-herbal.com',
    callbackUrl: 'https://dashboard.segulahglobal-herbal.com/auth/payment/callback',
    providers: {
      paystack: false,
      flutterwave: false,
      korapay: false,
      usdt: true,
    },
  },
};
