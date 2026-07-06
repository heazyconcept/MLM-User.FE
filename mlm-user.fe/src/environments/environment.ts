export const environment = {
  production: true,
  apiUrl: 'https://api.segulah.ng',
  wsUrl: 'https://api.segulah.ng',
  defaultReferralUsername: 'default',
  payments: {
    appUrl: 'https://dashboard.segulahglobal-herbal.com',
    callbackUrl: 'https://dashboard.segulahglobal-herbal.com/auth/payment/callback',
    providers: {
      paystack: true,
      flutterwave: true,
      usdt: false,
    },
  },
};
