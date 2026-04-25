export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Stable SecureStore keys for the access/refresh JWT pair. Hardcoded — not
// env-driven — because changing these between builds would orphan every
// user's stored token and force a fresh login after a Play Store update.
export const TOKEN_KEY = 'whatchat.auth.accessToken';
export const REFRESH_TOKEN_KEY = 'whatchat.auth.refreshToken';