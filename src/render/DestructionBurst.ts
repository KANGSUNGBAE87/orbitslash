import { Container, Graphics } from "pixi.js";
import { LAYER } from "../game/layers";

interface Particle {
  sprite: Graphics;
  angle: number;
  distance: number;
  spin: number;
  scale: number;
}

interface Burst {
  root: Container;
  ring: Graphics;
  coreFlash: Graphics;
  shockRings: Graphics[];
  particles: Particle[];
  age: number;
  lifeMs: number;
  radius: number;
  isLastSave: boolean;
}

export interface DestructionBurstOptions {
  color?: number;
  secondaryColor?: number;
  radius?: number;
  particleCount?: number;
  lifeMs?: number;
  isLastSave?: boolean;
}

const TAU = Math.PI * 2;
const NORMAL_LIFE_MS = 520;
const LAST_SAVE_LIFE_MS = 880;

export class DestructionBurst {
  readonly container: Container;
  private bursts: Burst[] = [];

  constructor() {
    this.container = new Container();
    this.container.zIndex = LAYER.EXPLOSION;
  }

  spawn(x: number, y: number, options: DestructionBurstOptions = {}): void {
    const isLastSave = options.isLastSave ?? false;
    const radius = options.radius ?? (isLastSave ? 72 : 46);
    const color = options.color ?? (isLastSave ? 0x3fd8ff : 0xff8a3d);
    const secondaryColor = options.secondaryColor ?? 0xffffff;
    const particleCount = options.particleCount ?? (isLastSave ? 26 : 14);

    const root = new Container();
    root.position.set(x, y);

    const coreFlash = new Graphics();
    coreFlash.circle(0, 0, radius * 0.18).fill({ color: secondaryColor, alpha: isLastSave ? 0.76 : 0.58 });
    coreFlash.circle(0, 0, radius * 0.34).stroke({ width: isLastSave ? 6 : 4, color, alpha: 0.45 });

    const ring = new Graphics();
    ring.circle(0, 0, radius * 0.35).stroke({ width: isLastSave ? 5 : 3, color, alpha: 0.8 });
    ring.circle(0, 0, radius * 0.18).stroke({ width: 2, color: secondaryColor, alpha: isLastSave ? 0.6 : 0.32 });

    const shockRings = [0, 1, 2].map((i) => {
      const shock = new Graphics();
      shock.circle(0, 0, radius * (0.42 + i * 0.16)).stroke({
        width: Math.max(2, radius * (isLastSave ? 0.04 : 0.028)),
        color: i === 1 ? secondaryColor : color,
        alpha: (isLastSave ? 0.28 : 0.2) - i * 0.045,
      });
      return shock;
    });
    root.addChild(coreFlash, ...shockRings, ring);

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * TAU + (isLastSave ? 0.18 : 0);
      const size = Math.max(3, radius * (i % 3 === 0 ? 0.085 : 0.06));
      const distance = radius * (isLastSave ? 1.55 : 1.2) * (0.72 + (i % 5) * 0.08);
      const sprite = new Graphics();
      if (i % 4 === 0) {
        sprite.moveTo(-size * 1.35, 0).lineTo(size * 1.35, 0).stroke({ width: Math.max(2, size * 0.55), color: secondaryColor, alpha: 0.88 });
        sprite.moveTo(0, -size * 0.62).lineTo(0, size * 0.62).stroke({ width: Math.max(1.5, size * 0.28), color, alpha: 0.6 });
      } else {
        sprite.circle(0, 0, size).fill({ color: i % 2 === 0 ? color : secondaryColor, alpha: 0.86 });
        sprite.circle(0, 0, size * 1.9).stroke({ width: Math.max(1, size * 0.18), color, alpha: 0.22 });
      }
      sprite.rotation = angle;
      root.addChild(sprite);
      particles.push({ sprite, angle, distance, spin: i % 2 === 0 ? 1 : -1, scale: 0.9 + (i % 4) * 0.12 });
    }

    this.container.addChild(root);
    this.bursts.push({
      root,
      ring,
      coreFlash,
      shockRings,
      particles,
      age: 0,
      lifeMs: options.lifeMs ?? (isLastSave ? LAST_SAVE_LIFE_MS : NORMAL_LIFE_MS),
      radius,
      isLastSave,
    });
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
      const eased = 1 - (1 - t) * (1 - t);
      const alpha = 1 - t;

      burst.root.alpha = alpha;
      burst.ring.scale.set(1 + eased * (burst.isLastSave ? 2.1 : 1.35));
      burst.coreFlash.scale.set(1 + eased * (burst.isLastSave ? 1.4 : 1.0));
      burst.coreFlash.alpha = Math.max(0, 1 - t * 1.8);
      burst.shockRings.forEach((shock, index) => {
        shock.scale.set(1 + eased * (burst.isLastSave ? 2.8 + index * 0.45 : 1.7 + index * 0.3));
        shock.alpha = Math.max(0, alpha * (0.95 - index * 0.18));
      });

      for (const particle of burst.particles) {
        const dist = particle.distance * eased;
        particle.sprite.position.set(Math.cos(particle.angle) * dist, Math.sin(particle.angle) * dist);
        particle.sprite.rotation = particle.angle + particle.spin * eased * Math.PI * 0.85;
        particle.sprite.scale.set(particle.scale * (1 - t * 0.55));
      }
    }

    const alive = this.bursts.filter((burst) => burst.age < burst.lifeMs);
    for (const dead of this.bursts) {
      if (dead.age >= dead.lifeMs) dead.root.destroy({ children: true });
    }
    this.bursts = alive;
  }
}
