export const environment = {
  production: true,
  apiUrl: 'https://api.segulahglobal-herbal.com',
  wsUrl: 'https://api.segulahglobal-herbal.com',
  defaultReferralUsername: 'default',
  payments: {
    appUrl: 'https://dashboard.segulahglobal-herbal.com',
    callbackUrl: 'https://dashboard.segulahglobal-herbal.com/auth/payment/callback',
    providers: {
      paystack: false,
      flutterwave: true,
      korapay: false,
      usdt: true,
    },
  },
};
