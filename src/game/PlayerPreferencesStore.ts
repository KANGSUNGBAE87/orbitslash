import type { Locale } from "../i18n";

export interface PlayerPreferences {
  version: 1;
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  hapticEnabled: boolean;
  reducedMotion: boolean;
  locale: Locale;
}

const STORAGE_KEY = "orbitslash.preferences.v1";

export function defaultPlayerPreferences(): PlayerPreferences {
  return { version: 1, bgmEnabled: true, sfxEnabled: true, hapticEnabled: true, reducedMotion: false, locale: "ko" };
}

export class PlayerPreferencesStore {
  constructor(private readonly storage: Pick<StoragePort, "storageGet" | "storageSet">) {}

  async load(): Promise<PlayerPreferences> {
    const raw = await this.storage.storageGet(STORAGE_KEY);
    if (!raw) return defaultPlayerPreferences();
    try {
      return normalize(JSON.parse(raw) as Partial<PlayerPreferences>);
    } catch {
      return defaultPlayerPreferences();
    }
  }

  async save(next: Omit<PlayerPreferences, "version">): Promise<PlayerPreferences> {
    const preferences: PlayerPreferences = { version: 1, ...next };
    await this.storage.storageSet(STORAGE_KEY, JSON.stringify(preferences));
    return preferences;
  }
}

interface StoragePort {
  storageGet(key: string): Promise<string | null>;
  storageSet(key: string, value: string): Promise<void>;
}

function normalize(value: Partial<PlayerPreferences>): PlayerPreferences {
  const defaults = defaultPlayerPreferences();
  return {
    version: 1,
    bgmEnabled: typeof value.bgmEnabled === "boolean" ? value.bgmEnabled : defaults.bgmEnabled,
    sfxEnabled: typeof value.sfxEnabled === "boolean" ? value.sfxEnabled : defaults.sfxEnabled,
    hapticEnabled: typeof value.hapticEnabled === "boolean" ? value.hapticEnabled : defaults.hapticEnabled,
    reducedMotion: typeof value.reducedMotion === "boolean" ? value.reducedMotion : defaults.reducedMotion,
    locale: value.locale === "en" || value.locale === "ko" ? value.locale : defaults.locale,
  };
}
