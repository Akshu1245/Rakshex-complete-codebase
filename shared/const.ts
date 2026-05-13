export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const ACCESS_TOKEN_MAX_AGE_MS = 1000 * 60 * 60; // 1 hour
export const IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 7; // 7 days of inactivity
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
