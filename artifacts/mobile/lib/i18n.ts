import { ar } from '../locales/ar';
import { en } from '../locales/en';

export const DEFAULT_LOCALE = "ar";
let currentLocale: "ar" | "en" = DEFAULT_LOCALE;

const translations = { ar, en };

export function setLocale(locale: "ar" | "en") {
  currentLocale = locale;
}

export function getLocale() {
  return currentLocale;
}

export function isRTL() {
  return currentLocale === "ar";
}

/**
 * Simple key-based translation function.
 * E.g. t('home.appName')
 */
export function t(key: string): string {
  const keys = key.split('.');
  let obj: any = translations[currentLocale];
  for (const k of keys) {
    if (obj && typeof obj === 'object') {
      obj = obj[k];
    } else {
      return key;
    }
  }
  return (obj as string) || key;
}

/**
 * Helper to display the appropriate food name from the DB object based on the current locale.
 * Arabic: nameAr || nameEn
 * English: nameEn || nameAr
 */
export function getLocalizedFoodName(food: { nameAr?: string, name?: string, nameEn?: string }, locale = currentLocale) {
  const arName = food.nameAr || food.name;
  const enName = food.nameEn || food.name;
  
  if (locale === "ar") {
    return arName || enName || "";
  }
  return enName || arName || "";
}
