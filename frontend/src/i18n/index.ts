import { en } from '../messages/en';
import { ar } from '../messages/ar';
import type { Locale, Translations } from '../types/i18n';

export { en, ar };

export const messages: Record<Locale, Translations> = {
  en,
  ar,
};

export const translations = messages;

export type { Locale, Translations } from '../types/i18n';
