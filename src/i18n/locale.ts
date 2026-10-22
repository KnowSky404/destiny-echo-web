export type Locale = "zh-CN" | "en";

export const LOCALE_STORAGE_KEY = "echoes.locale";

function savedLocale(): Locale {
  try {
    return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

let locale: Locale = savedLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return locale;
}

export function t(chinese: string, english: string): string {
  return locale === "en" ? english : chinese;
}

export function setLocale(next: Locale): void {
  if (next !== "zh-CN" && next !== "en") return;
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // The language still works when storage is disabled or full.
  }
  if (locale === next) return;
  locale = next;
  for (const listener of listeners) listener();
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
