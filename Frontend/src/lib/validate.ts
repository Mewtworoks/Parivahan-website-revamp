// Shared field-format checks — the same rules a real government portal would enforce,
// applied here so a wrong entry gets caught on this screen instead of at the counter.

/** Fixed "today" the rest of the prototype's date math already uses, kept in one place. */
export const TODAY_ISO = '2026-08-21';

export function isValidMobile(v: string): boolean {
  return /^[6-9]\d{9}$/.test(v);
}

export function isValidAadhaar(v: string): boolean {
  return /^\d{12}$/.test(v);
}

export function isValidVid(v: string): boolean {
  return /^\d{16}$/.test(v);
}

export function isValidPin(v: string): boolean {
  return /^[1-9]\d{5}$/.test(v);
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isValidOtp(v: string): boolean {
  return /^\d{4}$/.test(v);
}

/** Digits only, capped at maxLen — the shared onChange filter for every numeric field below. */
export function digitsOnly(v: string, maxLen: number): string {
  return v.replace(/\D/g, '').slice(0, maxLen);
}
