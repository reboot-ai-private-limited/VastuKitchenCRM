import { Linking } from 'react-native';

/** The 10-digit Indian mobile from any input (+91, 91, leading 0, spaces); null if it is not one. Mirrors phoneSchema in contracts. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.replace(/^0/, '');
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export const telUrl = (phone: string): string | null => {
  const n = normalizePhone(phone);
  return n ? `tel:+91${n}` : null;
};

export const whatsappUrlFor = (phone: string): string | null => {
  const n = normalizePhone(phone);
  return n ? `https://wa.me/91${n}` : null;
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
