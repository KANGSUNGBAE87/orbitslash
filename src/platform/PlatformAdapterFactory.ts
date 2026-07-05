import { AppsInTossAdapter, type AppsInTossBridge } from "./AppsInTossAdapter";
import { GooglePlayAdapter, type GooglePlayBridge } from "./GooglePlayAdapter";
import type { IPlatformAdapter } from "./PlatformAdapter";
import { WebStubAdapter } from "./WebStubAdapter";

export type PlatformTarget = "web" | "apps_in_toss" | "google_play";

export interface PlatformEnv {
  [key: string]: unknown;
  VITE_PLATFORM_TARGET?: string;
}

export interface PlatformRuntime {
  appsInTossBridge?: AppsInTossBridge;
  googlePlayBridge?: GooglePlayBridge;
}

export function createDefaultPlatformAdapter(
  env: PlatformEnv = import.meta.env,
  runtime: PlatformRuntime = defaultPlatformRuntime(),
): IPlatformAdapter {
  const target = resolvePlatformTarget(env, runtime);
  if (target === "apps_in_toss") return new AppsInTossAdapter(runtime.appsInTossBridge);
  if (target === "google_play") return new GooglePlayAdapter(runtime.googlePlayBridge);
  return new WebStubAdapter();
}

export function resolvePlatformTarget(env: PlatformEnv = {}, runtime: PlatformRuntime = {}): PlatformTarget {
  const requested = env.VITE_PLATFORM_TARGET;
  if (requested === "apps_in_toss" || requested === "google_play" || requested === "web") return requested;
  if (runtime.appsInTossBridge) return "apps_in_toss";
  if (runtime.googlePlayBridge) return "google_play";
  return "web";
}

function defaultPlatformRuntime(): PlatformRuntime {
  if (typeof window === "undefined") return {};
  const candidate = window as unknown as {
    __ORBITSLASH_APPS_IN_TOSS_BRIDGE__?: AppsInTossBridge;
    __ORBITSLASH_GOOGLE_PLAY_BRIDGE__?: GooglePlayBridge;
  };
  return {
    appsInTossBridge: candidate.__ORBITSLASH_APPS_IN_TOSS_BRIDGE__,
    googlePlayBridge: candidate.__ORBITSLASH_GOOGLE_PLAY_BRIDGE__,
  };
}
