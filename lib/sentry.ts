// lib/sentry.ts — Sentry disabled (not configured yet)
// All functions are no-ops to avoid breaking imports

export function initSentry(): void {}

export function setUserContext(phone: string, role: string): void {}

export function clearUserContext(): void {}

export function captureException(error: unknown): void {
  console.error(error);
}

export function captureMessage(message: string): void {
  console.log(message);
}