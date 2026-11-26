import { z } from 'zod';

export const PHONE_COUNTRIES = [
  { code: 'IN', name: 'India', dial: '+91', digits: 10, placeholder: '10-digit mobile' },
  { code: 'BT', name: 'Bhutan', dial: '+975', digits: 8, placeholder: '8-digit mobile' },
  { code: 'NP', name: 'Nepal', dial: '+977', digits: 10, placeholder: '10-digit mobile' },
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number];
export type PhoneCountryCode = PhoneCountry['code'];
export type PhoneDialCode = PhoneCountry['dial'];

const INDIA_RE = /^[6-9]\d{9}$/;
const BHUTAN_RE = /^\+975[1-8]\d{7}$/;
const NEPAL_RE = /^\+9779[6-8]\d{8}$/;

/**
 * Normalizes a phone number for India (+91), Bhutan (+975), or Nepal (+977):
 * - India: stored as 10 plain digits (`9876543210`) for backward compatibility.
 * - Bhutan: stored as `+975` + 8 digits (`+97517123456`).
 * - Nepal: stored as `+977` + 10 digits (`+9779841234567`).
 */
export function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('975') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('977') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
  return digits.replace(/^0/, '');
}

export const phoneSchema = z
  .string()
  .transform(normalizePhoneInput)
  .pipe(
    z
      .string()
      .refine(
        (v) => INDIA_RE.test(v) || BHUTAN_RE.test(v) || NEPAL_RE.test(v),
        'Enter a valid mobile number (India +91, Bhutan +975, or Nepal +977)',
      ),
  );

/** Splits a stored or raw phone string into its country dial code and local digits. */
export function splitPhone(raw: string): { dial: PhoneDialCode; local: string } {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+975') || (digits.startsWith('975') && digits.length === 11)) {
    return { dial: '+975', local: digits.slice(3, 11) };
  }
  if (trimmed.startsWith('+977') || (digits.startsWith('977') && digits.length === 13)) {
    return { dial: '+977', local: digits.slice(3, 13) };
  }
  if (trimmed.startsWith('+91') || (digits.startsWith('91') && digits.length === 12)) {
    return { dial: '+91', local: digits.slice(2, 12) };
  }
  return { dial: '+91', local: digits.replace(/^0/, '').slice(0, 10) };
}

/** Joins a dial code and local digits into a value accepted by `phoneSchema`. */
export function joinPhone(dial: PhoneDialCode, local: string): string {
  const digits = local.replace(/\D/g, '');
  if (!digits) return '';
  return dial === '+91' ? digits : `${dial}${digits}`;
}

/** E.164 format (`+919876543210`, `+97517123456`, `+9779841234567`). */
export function toE164Phone(phone: string): string {
  const { dial, local } = splitPhone(phone);
  return local ? `${dial}${local}` : phone;
}

/** Digits-only international format for `https://wa.me/<digits>`. */
export function toWaDigits(phone: string): string {
  return toE164Phone(phone).replace(/\D/g, '');
}

/** Always includes country code (`+91 98765 43210`, `+975 1712 3456`, `+977 98412 34567`). */
export function formatInternationalPhone(phone: string): string {
  const { dial, local } = splitPhone(phone);
  if (dial === '+975' && local.length === 8) {
    return `+975 ${local.slice(0, 4)} ${local.slice(4)}`;
  }
  if (dial === '+977' && local.length === 10) {
    return `+977 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  if (dial === '+91' && local.length === 10) {
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return phone;
}

/** Local format for India (`98765 43210`), international for Bhutan/Nepal (`+975 1712 3456`, `+977 98412 34567`). */
export function formatDisplayPhone(phone: string): string {
  const { dial, local } = splitPhone(phone);
  if (dial === '+91' && local.length === 10) {
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return formatInternationalPhone(phone);
}
