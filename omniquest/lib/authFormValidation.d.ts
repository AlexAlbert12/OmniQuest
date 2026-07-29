export type AuthFormErrors = Record<string, string>
export type AuthAttemptGateResult = { allowed: boolean; retryAfterSeconds?: number }

export function normalizeEmail(email: string): string
export function isValidEmail(email: string): boolean
export function getPasswordChecks(password: string): {
  length: boolean
  mixedCase: boolean
  number: boolean
  symbol: boolean
}
export function isStrongPassword(password: string): boolean
export function validateLoginForm(
  values: { email: string; password: string },
  messages?: Record<string, string>,
): AuthFormErrors
export function validateRegistrationForm(
  values: { alias: string; email: string; password: string; confirmPassword: string },
  messages?: Record<string, string>,
): AuthFormErrors
export function validateRecoveryForm(
  values: { email: string },
  messages?: Record<string, string>,
): AuthFormErrors
export function validatePasswordUpdateForm(
  values: { password: string; confirmPassword: string },
  messages?: Record<string, string>,
): AuthFormErrors
export function hasErrors(errors: AuthFormErrors): boolean
export function prepareAuthSubmission<TValues>(options: {
  values: TValues
  validate: (values: TValues) => AuthFormErrors
  guard: () => Promise<AuthAttemptGateResult>
}): Promise<
  | { status: 'validation_error'; errors: AuthFormErrors }
  | { status: 'rate_limited'; errors: AuthFormErrors; retryAfterSeconds: number }
  | { status: 'ready'; errors: AuthFormErrors; retryAfterSeconds: number }
>

export function buildPublicStudentSignUpOptions(alias: string, emailRedirectTo: string): { emailRedirectTo: string; data: { alias: string } }
