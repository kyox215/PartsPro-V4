export const SIGNUP_VERIFICATION_EMAIL_COOKIE = "partspro_signup_verification_email";
export const SIGNUP_VERIFICATION_COOKIE_MAX_AGE_SECONDS = 60 * 60;

export function normalizeSignupVerificationEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeSignupVerificationCode(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 10) : "";
}
