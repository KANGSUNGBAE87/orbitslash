import ko from "./ko.json";
import en from "./en.json";

// i18n 라우터. 기본 ko, en 선택 가능 (CLAUDE.md i18n 규칙: 첫 버전부터).
// 사용자 대면 문자열은 전부 t(key)를 경유한다 — 하드코딩 금지.

export type Locale = "ko" | "en";

type Dict = Record<string, string>;

const dictionaries: Record<Locale, Dict> = {
  ko: ko as Dict,
  en: en as Dict,
};

let currentLocale: Locale = "ko";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * 키로 현재 로케일 문자열을 가져온다. 키가 없으면 키 자체를 반환(누락 가시화).
 * params로 `{name}` 형태 치환 지원.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLocale];
  let value = dict[key] ?? dictionaries.ko[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return value;
}
