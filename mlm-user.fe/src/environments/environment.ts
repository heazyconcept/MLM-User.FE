// apiUrl must be set or API requests will go to the current origin.
// On Render, set API_URL in Environment and use a build command that writes this file from process.env.
export const environment = {
  production: true,
  apiUrl: 'https://segulah-api.onrender.com',
  defaultReferralCode: 'REF000000',
};
