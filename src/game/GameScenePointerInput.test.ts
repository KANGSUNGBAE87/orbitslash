import { describe, expect, it, vi } from "vitest";
import { GameScene } from "./GameScene";
import type { EarthRef, Point } from "./types";

const earth: EarthRef = { cx: 540, cy: 900, r: 50 };

function pointerEvent(pointerId: number, x: number, y: number): any {
  return {
    pointerId,
    getLocalPosition: () => ({ x, y }),
  };
}

function makeSceneStub() {
  const scene: any = Object.create(GameScene.prototype);
  scene.running = true;
  scene.stage = {};
  scene.activePointerId = null;
  scene.livePoints = [];
  scene.strokeHadHit = false;
  scene.strokeKills = [];
  scene.strokeMoved = false;
  scene.strokeDirectionalRejects = new Set<number>();
  scene.strokeHitTracker = { reset: vi.fn() };
  scene.gesture = {
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn((p: Point) => ({ points: [...scene.livePoints, p] })),
  };
  scene.slashTrail = {
    setLive: vi.fn(),
    release: vi.fn(),
  };
  scene.earth = { ref: vi.fn(() => earth) };
  scene.shouldReserveStrokeForSolarLance = vi.fn(() => false);
  scene.shouldReserveStrokeForGravitySlow = vi.fn(() => false);
  scene.resolveLiveSlashSegment = vi.fn();
  scene.resolveInput = vi.fn();
  return scene;
}

describe("GameScene pointer input", () => {
  it("ignores a second pointer while one stroke is active", () => {
    const scene = makeSceneStub();

    scene.onPointerDown(pointerEvent(1, 100, 100));
    scene.onPointerDown(pointerEvent(2, 900, 900));

    expect(scene.gesture.onPointerDown).toHaveBeenCalledTimes(1);
    expect(scene.livePoints).toHaveLength(1);
    expect(scene.livePoints[0]).toMatchObject({ x: 100, y: 100 });
  });

  it("ignores move and up events from non-active pointers", () => {
    const scene = makeSceneStub();

    scene.onPointerDown(pointerEvent(1, 100, 100));
    scene.onPointerMove(pointerEvent(2, 950, 950));
    scene.onPointerUp(pointerEvent(2, 950, 950));

    expect(scene.gesture.onPointerMove).not.toHaveBeenCalled();
    expect(scene.resolveInput).not.toHaveBeenCalled();
    expect(scene.livePoints).toHaveLength(1);

    scene.onPointerMove(pointerEvent(1, 180, 180));
    scene.onPointerUp(pointerEvent(1, 200, 200));

    expect(scene.gesture.onPointerMove).toHaveBeenCalledTimes(1);
    expect(scene.resolveInput).toHaveBeenCalledTimes(1);
  });
});
