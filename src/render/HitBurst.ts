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

const LIFE_MS = 620;

function textStyle(color: number): TextStyle {
  return new TextStyle({
    fontFamily: "Arial, sans-serif",
    fontSize: 32,
    fontWeight: "bold",
    fill: color,
    stroke: { color: 0x05060f, width: 5 },
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

  spawn(x: number, y: number, label: string, color: number, radius: number, isLastSave = false): void {
    const root = new Container();
    root.position.set(x, y);

    const ring = new Graphics();
    ring.circle(0, 0, radius).stroke({ width: isLastSave ? 5 : 3, color, alpha: 0.95 });
    ring.circle(0, 0, radius * 0.55).stroke({ width: 2, color: 0xffffff, alpha: isLastSave ? 0.7 : 0.35 });

    const text = new Text({ text: label, style: textStyle(color) });
    text.anchor.set(0.5);
    text.position.set(0, -radius - 24);

    root.addChild(ring, text);
    this.container.addChild(root);
    this.bursts.push({ root, ring, text, age: 0, lifeMs: LIFE_MS, radius, isLastSave });
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
