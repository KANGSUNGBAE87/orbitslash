import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { LAYER } from "../game/layers";

interface Burst {
  root: Container;
  ring: Graphics;
  text: Text;
  age: number;
  lifeMs: number;
  radius: number;
  isLastSave: boolean;
}

export interface HitBurstOptions {
  labelScale?: number;
  ringWidth?: number;
  lifeMs?: number;
}

const LIFE_MS = 620;

function textStyle(color: number, scale = 1): TextStyle {
  return new TextStyle({
    fontFamily: "Arial, sans-serif",
    fontSize: Math.round(32 * scale),
    fontWeight: "bold",
    fill: color,
    stroke: { color: 0x05060f, width: Math.max(4, Math.round(5 * scale)) },
    align: "center",
  });
}

export class HitBurst {
  readonly container: Container;
  private bursts: Burst[] = [];

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.EXPLOSION;
  }

  spawn(x: number, y: number, label: string, color: number, radius: number, isLastSave = false, options: HitBurstOptions = {}): void {
    const root = new Container();
    root.position.set(x, y);

    const ring = new Graphics();
    const ringWidth = options.ringWidth ?? (isLastSave ? 5 : 3);
    ring.circle(0, 0, radius).stroke({ width: ringWidth, color, alpha: 0.95 });
    ring.circle(0, 0, radius * 0.55).stroke({ width: Math.max(2, ringWidth * 0.45), color: 0xffffff, alpha: isLastSave ? 0.7 : 0.35 });

    const text = new Text({ text: label, style: textStyle(color, options.labelScale ?? 1) });
    text.anchor.set(0.5);
    text.position.set(0, -radius - 24);

    root.addChild(ring, text);
    this.container.addChild(root);
    this.bursts.push({ root, ring, text, age: 0, lifeMs: options.lifeMs ?? LIFE_MS, radius, isLastSave });
  }

  clear(): void {
    for (const burst of this.bursts) burst.root.destroy({ children: true });
    this.bursts = [];
    this.container.removeChildren();
  }

  update(dtMs: number): void {
    if (this.bursts.length === 0) return;

    for (const burst of this.bursts) {
      burst.age += dtMs;
      const t = Math.min(1, burst.age / burst.lifeMs);
      const alpha = 1 - t;
      const ringScale = 1 + t * (burst.isLastSave ? 1.1 : 0.65);

      burst.root.alpha = alpha;
      burst.ring.scale.set(ringScale);
      burst.text.y = -burst.radius - 24 - t * 42;
    }

    const alive = this.bursts.filter((burst) => burst.age < burst.lifeMs);
    for (const dead of this.bursts) {
      if (dead.age >= dead.lifeMs) dead.root.destroy({ children: true });
    }
    this.bursts = alive;
  }
}
