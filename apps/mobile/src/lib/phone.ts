import { Linking } from 'react-native';
import { phoneSchema, toE164Phone, toWaDigits } from '@vastu/contracts';

/** Validates and normalizes an India (+91), Bhutan (+975), or Nepal (+977) mobile number; null if invalid. */
export function normalizePhone(input: string): string | null {
  const parsed = phoneSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export const telUrl = (phone: string): string | null => {
  const n = normalizePhone(phone);
  return n ? `tel:${toE164Phone(n)}` : null;
};

export const whatsappUrlFor = (phone: string, text?: string): string | null => {
  const n = normalizePhone(phone);
  if (!n) return null;
  const base = `https://wa.me/${toWaDigits(n)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
};

/** Open a tel:/wa.me link; never throws (no dialer, bad number). Returns false when nothing opened. */
export async function openLink(url: string | null): Promise<boolean> {
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
