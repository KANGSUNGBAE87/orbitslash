import { defineConfig } from "vitest/config";

// 순수 로직 단위 테스트 전용 설정. PixiJS를 import하는 모듈은 테스트 대상이 아니다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/game/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
