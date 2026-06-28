import { GameApp } from "./game/GameApp";
import { RemoteConfig } from "./game/RemoteConfig";

// Vite 진입점. RemoteConfig 준비 후 PixiJS 앱 부트스트랩 (implementation-plan §9-1).
// `npm run dev` → 검은 우주 배경에 작은 지구가 천천히 회전하는 화면.

async function bootstrap(): Promise<void> {
  await RemoteConfig.ready();

  const mount = document.getElementById("app");
  if (!mount) throw new Error("#app mount element not found");

  const game = new GameApp();
  await game.init(mount);
}

void bootstrap();
