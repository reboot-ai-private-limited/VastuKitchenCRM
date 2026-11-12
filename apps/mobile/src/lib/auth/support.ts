/** Coordinator contact for account requests. Set EXPO_PUBLIC_SUPPORT_WHATSAPP (digits with country code). */
export const SUPPORT_WHATSAPP = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@vastukitchen.in';
