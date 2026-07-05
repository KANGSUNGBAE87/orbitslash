import { GameApp } from "./game/GameApp";
import { RemoteConfig } from "./game/RemoteConfig";
import { createDefaultPlatformAdapter } from "./platform/PlatformAdapterFactory";
import { preloadAppVisualAssets } from "./render/AppVisualAssets";

// Vite 진입점. RemoteConfig 준비 후 PixiJS 앱 부트스트랩 (implementation-plan §9-1).
// `npm run dev` → 검은 우주 배경에 작은 지구가 천천히 회전하는 화면.

export interface BootstrapGame {
  init(mount: HTMLElement, beforeReady?: () => Promise<void>): Promise<void>;
}

export interface BootstrapDeps {
  getMount: () => HTMLElement | null;
  createGame: () => BootstrapGame;
  remoteReady: () => Promise<void>;
  preloadAssets: () => Promise<void>;
}

const defaultBootstrapDeps: BootstrapDeps = {
  getMount: () => document.getElementById("app"),
  createGame: () => new GameApp({ platform: createDefaultPlatformAdapter() }),
  remoteReady: () => RemoteConfig.ready(),
  preloadAssets: () => preloadAppVisualAssets(),
};

export async function bootstrap(deps: BootstrapDeps = defaultBootstrapDeps): Promise<void> {
  const mount = deps.getMount();
  if (!mount) throw new Error("#app mount element not found");

  const game = deps.createGame();
  await game.init(mount, async () => {
    await deps.remoteReady();
    await deps.preloadAssets();
  });
}

if (typeof document !== "undefined") void bootstrap();
