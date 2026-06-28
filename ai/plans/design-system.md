---
version: 0.1
status: draft
updated: 2026-06-28
canonical: true
---

# Orbit Slash — Design System v0.1

> Single implementable reference for colors, typography, spacing, motion, and
> component specs. Derived from design-plan.md v1.1 (Visual SSOT) and
> product-plan.md v1.0. Covers React/HTML menu screens and PixiJS Canvas HUD
> overlay layer. Do NOT contradict design-plan §2 (earth size) or product-plan §8
> (canonical 4 skills).

## Change Log

- 2026-06-28 (claude): v0.1 initial design system. Palette locked from design-plan
  §1.2 art direction (colors.io timed out, Coolors page did not expose hex data —
  hex values derived from stated direction and cosmic neon arcade conventions).
  ui-ux-pro-max recorded as verification step (not run; to be used at UI
  implementation milestone). React Bits: 3 candidate components for menu screens only.

---

## CRITICAL CONSTRAINTS (Must Restate)

1. **Earth size — gameplay**: body 280–330 px, shield 390–460 px. NEVER exceed
   500 px even in boss stages. Design-sample mockups draw earth oversized —
   ignore those proportions for gameplay; honor §2 of design-plan only.
2. **Text/numbers always code-rendered**: panel frames, icons, button shells may
   be sprites/images. All actual text, numerals, counters, timers, and labels
   are HTML/CSS or Canvas Text — never baked into image assets.
3. **Skill-name conflict**: mockup images show Laser Strike / Plasma Burst /
   Missile Barrage / Frost Bomb / Black Hole / Hyper Drone / Orbital Slash etc.
   CANONICAL skills = exactly 4 from product-plan §8:
   - Orbital Cut (mockup "Orbital Slash" = this)
   - Solar Lance
   - Gravity Slow
   - Delta Shield
   Mockup extra button names are art-direction references only. Design system
   uses the 4 canonical skills only. Extension requires Owner approval.
4. **No static screen images**: all screens are layered, reusable components
   (design-plan §10 layer stack). Never build a gameplay screen as one background image.
5. **Base coordinate system**: 1080 × 1920 px, vertical 9:16. Scale by
   `Math.min(screenW / 1080, screenH / 1920)`.

---

## STEP 1 — Design Preflight Results

### 1.1 Palette Validation

**Web tool status**: colors.io timed out; Coolors trending page did not return
usable hex data. Proceeding from design-plan §1.2 art direction + cosmic neon
arcade conventions. Art direction is already strong and specific — task is
validation and tokenization, not invention.

**Validation verdict**: the defined color grammar (deep navy bg / cyan-electric
earth / orange-red danger / purple gravity / blue-white-green friendly / gold
CTA) is a well-established "neon sci-fi arcade" palette with strong internal
contrast logic. Additive-blend glows on dark backgrounds are perceptually safe.
Primary risk: cyan-on-navy HUD text contrast — mitigated by minimum 4.5:1 rule
applied in token layer below.

### 1.2 React Bits Fit — Menu Screens Only

React Bits is applicable ONLY to React/HTML menu and dialog screens
(/src/ui/*.tsx). Do NOT use React Bits inside PixiJS Canvas gameplay.

**Candidate components (3)**:

| # | Component | Screen | Rationale |
|---|-----------|--------|-----------|
| 1 | **GlowingCard / Tilt Card** | Mode Select grid (6 cards) | Each mode card benefits from subtle 3D tilt + neon border glow on hover/tap — matches the beveled glossy panel direction without custom WebGL. |
| 2 | **CountUp / Number Ticker** | Result screen score reveal | Animated number roll-up on Victory/Game Over score display reinforces the score-drama moment. Lightweight, no canvas dependency. |
| 3 | **Animated Border / Gradient Border** | START button + dialog CTAs | Rotating or pulsing gradient border on the gold START button creates the "active pulse" state without custom CSS keyframe work. |

**Verdict**: install on demand per screen, verify 60fps on mid-range Android
WebView, verify reduced-motion behavior before shipping each.

### 1.3 ui-ux-pro-max — Verification Gate

Record as the verification step at UI implementation milestone:
```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/design_system.py \
  "premium neon cosmic defense arcade, mobile WebView, glossy sci-fi, intense but readable" \
  --project-name "orbit-slash" --format markdown
```
Convergence = external validation. Divergence = candidate alternatives only,
adopt via decision record. This design system + design-plan remain SSOT.

---

## STEP 2 — Design System

---

## 2. Color Tokens

### 2.1 Primitive Layer (raw hex)

```css
:root {
  /* Navy / Space backgrounds */
  --navy-950: #050a1a;   /* deepest space void */
  --navy-900: #080e24;   /* primary bg */
  --navy-800: #0d1535;   /* surface panels */
  --navy-700: #131d4a;   /* elevated surface */
  --navy-600: #1a2660;   /* border / divider */

  /* Purple / Gravity */
  --purple-900: #1a0a2e;
  --purple-700: #3d1a72;
  --purple-500: #7c3aed;
  --purple-400: #a855f7;
  --purple-300: #c084fc;
  --purple-glow: #9333ea;

  /* Cyan / Electric Blue — Earth & Shield */
  --cyan-500: #06b6d4;
  --cyan-400: #22d3ee;
  --cyan-300: #67e8f9;
  --cyan-200: #a5f3fc;
  --electric-500: #3b82f6;
  --electric-400: #60a5fa;
  --electric-300: #93c5fd;
  --ice-500: #7dd3fc;    /* ice comet / ice fragment */
  --ice-300: #bae6fd;

  /* Orange / Red — Danger Meteors */
  --orange-600: #ea580c;
  --orange-500: #f97316;
  --orange-400: #fb923c;
  --orange-300: #fdba74;
  --red-700: #b91c1c;
  --red-600: #dc2626;
  --red-500: #ef4444;
  --lava-500: #ff4500;   /* lava meteor / fire comet */
  --lava-300: #ff6b35;

  /* Gold / CTA */
  --gold-600: #b45309;
  --gold-500: #d97706;
  --gold-400: #f59e0b;
  --gold-300: #fbbf24;
  --gold-200: #fde68a;

  /* Green — Friendly / Rescue */
  --green-600: #059669;
  --green-500: #10b981;
  --green-400: #34d399;
  --green-300: #6ee7b7;

  /* White / Neutral */
  --white-100: #f8fafc;
  --white-200: #e2e8f0;
  --white-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-600: #475569;

  /* Black / Overlay */
  --black-alpha-60: rgba(0, 0, 0, 0.6);
  --black-alpha-80: rgba(0, 0, 0, 0.8);
}
```

### 2.2 Semantic Layer

```css
:root {
  /* Backgrounds */
  --bg-space:            var(--navy-900);   /* app root bg */
  --bg-space-deep:       var(--navy-950);   /* vignette edges */
  --bg-surface:          var(--navy-800);   /* HUD panels, cards */
  --bg-surface-raised:   var(--navy-700);   /* modal / dialog bg */
  --bg-overlay:          var(--black-alpha-80);

  /* Earth & Shield */
  --earth-core:          var(--electric-500);  /* earth body dominant */
  --earth-shield:        var(--cyan-400);      /* shield ring primary */
  --earth-shield-glow:   var(--cyan-300);
  --earth-healthy:       var(--cyan-500);      /* 70–100% energy */
  --earth-cracked:       var(--electric-400);  /* 40–69% energy */
  --earth-danger:        var(--red-500);       /* 10–39% energy */
  --earth-critical:      var(--red-600);       /* <10% energy */
  --earth-hex-grid:      rgba(34, 211, 238, 0.18); /* shield hex grid */

  /* Danger — Meteors / Boss */
  --danger-meteor:       var(--orange-500);   /* standard meteor */
  --danger-fire:         var(--lava-500);     /* fire meteor */
  --danger-boss:         var(--red-700);      /* boss body / HP bar */
  --danger-threat:       var(--orange-400);   /* threat gauge fill */
  --danger-threat-high:  var(--red-500);      /* threat >75% */

  /* Ice enemies */
  --ice-meteor:          var(--ice-500);
  --ice-trail:           var(--ice-300);

  /* Gravity / Blackhole */
  --gravity-core:        var(--purple-500);
  --gravity-glow:        var(--purple-300);
  --blackhole:           var(--purple-900);

  /* Friendly — Rescue / Capsules / Satellites */
  --friendly:            var(--electric-400);  /* default friendly */
  --friendly-rescue:     var(--cyan-300);
  --friendly-capsule:    var(--green-400);
  --friendly-satellite:  var(--electric-300);
  --friendly-indicator:  var(--green-500);    /* RESCUE INBOUND */

  /* Skills */
  --skill-orbital-cut:   var(--cyan-400);     /* Orbital Cut */
  --skill-solar-lance:   var(--gold-400);     /* Solar Lance */
  --skill-gravity-slow:  var(--purple-400);   /* Gravity Slow */
  --skill-delta-shield:  var(--cyan-200);     /* Delta Shield (lighter cyan) */

  /* CTA / Actions */
  --cta-primary:         var(--gold-400);     /* START button */
  --cta-primary-glow:    var(--gold-300);
  --cta-secondary:       var(--electric-400);

  /* Score / Ranking */
  --rank-gold:           var(--gold-400);
  --rank-purple:         var(--purple-400);
  --rank-score:          var(--white-100);

  /* Mode cards */
  --mode-story:          var(--electric-500);
  --mode-free-defense:   var(--green-500);
  --mode-ranked:         var(--purple-500);
  --mode-boss-rush:      var(--red-600);
  --mode-60s-blitz:      var(--cyan-500);
  --mode-daily:          var(--gold-400);

  /* Text */
  --text-primary:        var(--white-100);
  --text-secondary:      var(--white-300);
  --text-muted:          var(--gray-400);
  --text-hud-value:      var(--white-100);    /* HUD numbers */
  --text-hud-label:      var(--cyan-300);     /* HUD labels */
  --text-danger:         var(--red-500);
  --text-friendly:       var(--green-400);
  --text-gold:           var(--gold-300);
  --text-score:          var(--white-100);

  /* Borders */
  --border-panel:        rgba(6, 182, 212, 0.25);   /* HUD panel edges */
  --border-active:       var(--cyan-400);
  --border-danger:       var(--red-500);
  --border-skill:        rgba(255, 255, 255, 0.15);

  /* Last Save */
  --last-save-color:     var(--gold-300);
  --last-save-glow:      var(--gold-400);

  /* Combo */
  --combo-color:         var(--orange-300);
  --combo-max:           var(--gold-300);
}
```

### 2.3 Glow / Shadow Tokens

```css
:root {
  /* Outer glow (additive feel — use on dark bg only) */
  --glow-cyan-sm:   0 0 8px  rgba(34, 211, 238, 0.7),
                    0 0 16px rgba(34, 211, 238, 0.4);
  --glow-cyan-md:   0 0 12px rgba(34, 211, 238, 0.8),
                    0 0 32px rgba(34, 211, 238, 0.45),
                    0 0 64px rgba(34, 211, 238, 0.2);
  --glow-cyan-lg:   0 0 20px rgba(34, 211, 238, 0.9),
                    0 0 60px rgba(34, 211, 238, 0.5),
                    0 0 120px rgba(34, 211, 238, 0.2);

  --glow-gold-sm:   0 0 8px  rgba(245, 158, 11, 0.7),
                    0 0 16px rgba(245, 158, 11, 0.4);
  --glow-gold-md:   0 0 12px rgba(245, 158, 11, 0.85),
                    0 0 32px rgba(245, 158, 11, 0.5);

  --glow-orange-sm: 0 0 8px  rgba(249, 115, 22, 0.7),
                    0 0 20px rgba(249, 115, 22, 0.4);
  --glow-orange-md: 0 0 16px rgba(249, 115, 22, 0.85),
                    0 0 40px rgba(249, 115, 22, 0.4);

  --glow-purple-sm: 0 0 8px  rgba(168, 85, 247, 0.7),
                    0 0 20px rgba(168, 85, 247, 0.4);
  --glow-purple-md: 0 0 16px rgba(168, 85, 247, 0.85),
                    0 0 48px rgba(168, 85, 247, 0.35);

  --glow-red-sm:    0 0 8px  rgba(239, 68, 68, 0.8),
                    0 0 20px rgba(239, 68, 68, 0.4);

  --glow-green-sm:  0 0 8px  rgba(52, 211, 153, 0.7),
                    0 0 16px rgba(52, 211, 153, 0.35);

  /* Panel / inner shadow */
  --shadow-panel:    inset 0 1px 0 rgba(255,255,255,0.06),
                     0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-button:   inset 0 1px 0 rgba(255,255,255,0.12),
                     0 2px 8px  rgba(0, 0, 0, 0.6),
                     0 0 0 1px  rgba(255,255,255,0.06);
  --shadow-dialog:   0 8px 48px rgba(0, 0, 0, 0.75),
                     0 0 0 1px  rgba(6, 182, 212, 0.15);
}
```

### 2.4 Contrast Check

Key pairs verified against WCAG AA (4.5:1 for body, 3:1 for large text/UI):

| Foreground | Background | Approx ratio | Pass |
|------------|------------|-------------|------|
| `--white-100` (#f8fafc) | `--navy-900` (#080e24) | ~18:1 | AA+ |
| `--cyan-300` (#67e8f9) | `--navy-900` (#080e24) | ~11:1 | AA+ |
| `--gold-300` (#fbbf24) | `--navy-900` (#080e24) | ~10:1 | AA+ |
| `--orange-400` (#fb923c) | `--navy-900` (#080e24) | ~7:1 | AA+ |
| `--cyan-400` (#22d3ee) | `--navy-800` (#0d1535) | ~8:1 | AA+ |
| `--white-100` (#f8fafc) | `--navy-800` (#0d1535) | ~14:1 | AA+ |
| `--gray-400` (#94a3b8) | `--navy-800` (#0d1535) | ~5.5:1 | AA |

---

## 3. Typography Scale

All text is code-rendered (HTML/CSS or Canvas Text). Never bake text into image assets.

```css
:root {
  /* Font stacks */
  --font-display:  'Exo 2', 'Rajdhani', 'Orbitron', system-ui, sans-serif;
  --font-hud:      'Rajdhani', 'Exo 2', 'Bebas Neue', monospace; /* condensed numerals */
  --font-mono:     'JetBrains Mono', 'Fira Code', monospace;     /* debug/dev only */
  --font-body:     'Exo 2', 'Noto Sans KR', system-ui, sans-serif;

  /* Display / Logo */
  --text-logo:     clamp(64px, 10vw, 100px);
  --text-logo-ls:  0.08em;
  --text-logo-fw:  800;

  /* HUD numerals — mono, condensed, large */
  --text-hud-xl:   52px;   /* score primary */
  --text-hud-lg:   40px;   /* timer primary */
  --text-hud-md:   32px;   /* threat %, energy value */
  --text-hud-sm:   22px;   /* hud labels (SCORE / TIME / THREAT) */
  --text-hud-xs:   18px;   /* sub-labels, cooldown counter */
  --text-hud-fw:   700;
  --text-hud-ls:   0.04em;

  /* Title / Stage name */
  --text-title:    36px;
  --text-title-fw: 700;

  /* Section / Card headers */
  --text-heading:  28px;
  --text-heading-fw: 600;

  /* Body */
  --text-body:     22px;
  --text-body-sm:  18px;
  --text-body-fw:  400;

  /* Labels / badges */
  --text-label:    16px;
  --text-label-sm: 13px;
  --text-label-fw: 600;
  --text-label-ls: 0.06em;
  --text-label-tt: uppercase;

  /* Combo / Last Save banners — impact */
  --text-impact:   clamp(44px, 6vw, 72px);
  --text-impact-fw: 800;
  --text-impact-ls: 0.05em;

  /* Mission / tutorial callouts */
  --text-callout:  24px;
  --text-callout-fw: 500;

  /* Line heights */
  --lh-tight:  1.15;
  --lh-normal: 1.4;
  --lh-loose:  1.6;
}
```

**Korean / i18n note**: `Noto Sans KR` covers the full Hangul character set.
All UI copy routes through the i18n layer — no hard-coded Korean strings in
components. Korean text may run 15–25% longer than English; HUD panels and
mode cards must accommodate both without overflow clipping.

---

## 4. Spacing Scale

Base unit = 8 px (1080×1920 coordinate system).

```css
:root {
  --space-1:  8px;
  --space-2:  16px;
  --space-3:  24px;
  --space-4:  32px;
  --space-5:  40px;
  --space-6:  48px;
  --space-8:  64px;
  --space-10: 80px;
  --space-12: 96px;
  --space-16: 128px;

  /* Safe areas */
  --safe-top:    60px;   /* status bar + notch clearance */
  --safe-bottom: 40px;   /* home indicator clearance */

  /* HUD bar height */
  --hud-height:  160px;
  --skill-bar-start-y: 1540px;  /* minimum Y for skill button top edge */
}
```

---

## 5. Radius Scale

```css
:root {
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-2xl:  32px;
  --radius-pill: 9999px;
  --radius-circle: 50%;  /* skill buttons, energy rings */
}
```

---

## 6. Motion / Timing Tokens

```css
:root {
  /* Durations */
  --dur-instant:   80ms;
  --dur-fast:      150ms;
  --dur-normal:    250ms;
  --dur-slow:      400ms;
  --dur-pulse:     1400ms;  /* skill ready glow pulse cycle */
  --dur-sweep:     600ms;   /* button light-sweep on hover */
  --dur-slash-fade: 300ms;  /* slash trail fade-out */
  --dur-cooldown:  varies;  /* driven by skill cooldown value */
  --dur-dialog-in: 220ms;
  --dur-dialog-out: 180ms;
  --dur-last-save: 800ms;   /* LAST SAVE banner appear + hold */
  --dur-combo-pop: 200ms;   /* combo counter pop scale */
  --dur-score-roll: 1200ms; /* result screen score count-up */

  /* Easing */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-back:  cubic-bezier(0.34, 1.56, 0.64, 1); /* button pop */
  --ease-in-out:    cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring:    cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* Button press scale */
  --btn-press-scale: 0.93;
  --btn-press-dur:   80ms;
  --btn-release-dur: 150ms;
  --btn-release-ease: var(--ease-out-back);

  /* Skill button pulse (ready state) */
  --skill-pulse-scale-min: 1.0;
  --skill-pulse-scale-max: 1.05;
  --skill-pulse-glow-min: 0.6;
  --skill-pulse-glow-max: 1.0;
}
```

---

## 7. Component Specs

All coordinates are in the 1080×1920 base system. Apply the global scale
factor for actual screen rendering.

---

### 7.1 Top HUD Bar

**Location**: Y 0–160, full width 1080.

**Structure**:
```
[ Energy Panel ] [ Score/Timer Panel ] [ Threat Gauge ]
  x:0 w:320        x:360 w:360          x:720 w:360
  h:160            h:160                h:160
```

**Panel base style**:
```css
background:    linear-gradient(180deg, var(--navy-800) 0%, var(--navy-900) 100%);
border-bottom: 1px solid var(--border-panel);
box-shadow:    var(--shadow-panel);
padding:       var(--space-2) var(--space-3);
```

**States**: none (always visible during gameplay). Transitions only on value
changes (energy flash, score increment animation).

---

### 7.2 Earth Energy Panel (HUD left)

**Props**: `energy: number` (0–100), `maxEnergy: number`, `label: string`

**Layout** (within HUD left cell, 320×160):
```
[ ⚡ icon 32×32 ] [ value 120/120 ] [ label ENERGY ]
icon color = current shield state color
value font = --text-hud-lg / --font-hud / bold
label font = --text-hud-xs / uppercase / --text-hud-label
```

**States**:
| Energy | Icon/value color | Background tint |
|--------|-----------------|-----------------|
| 70–100 | `--earth-healthy` | none |
| 40–69 | `--earth-cracked` | none |
| 10–39 | `--earth-danger` | rgba(239,68,68,0.08) |
| < 10 | `--earth-critical` + flash animation | rgba(239,68,68,0.18) |

**Flash animation** (< 10 energy):
```css
@keyframes energy-critical {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
animation: energy-critical 600ms ease-in-out infinite;
```

---

### 7.3 Score / Timer Panel (HUD center)

**Props**: `mode: 'score' | 'timer' | 'boss'`, `value: number | string`,
`bossName?: string`

**Layout** (360×160 center):
- Score mode: `SCORE` label top / value large below
- Timer mode: `TIME` label top / `MM:SS.ss` value large
- Boss mode: boss name medium + HP bar (see §7.10)

**Value style**:
```css
font:    var(--text-hud-xl) / var(--text-hud-fw) / var(--font-hud);
color:   var(--text-hud-value);
letter-spacing: var(--text-hud-ls);
text-align: center;
```

**Combo multiplier badge** (overlays center, appears when combo ≥ 5):
```
size: 80×44px, position: bottom-right of score panel
background: var(--orange-600), border-radius: var(--radius-md)
text: "×2.0" / --text-hud-sm / bold / white
pop animation: scale 1→1.3→1 over 200ms ease-out-back on every increment
```

---

### 7.4 Threat Gauge (HUD right)

**Props**: `threat: number` (0–100)

**Layout** (360×160 right):
```
[ ☠ icon 28×28 ] [ THREAT label ] [ value 78% ]
[ segment bar   — full width 280px h:16px     ]
```

**Segment bar**: 10 segments, filled left-to-right.
```css
/* per segment */
width: 24px; height: 16px; border-radius: 3px; gap: 4px;
filled-color (0–74%):  var(--danger-threat);
filled-color (75–99%): var(--danger-threat-high);
filled-color (100%):   var(--red-600) with glow-red-sm pulse;
```

**Boss warning state** (threat = 100):
```
overlay text "WARNING" centered / --text-impact size 52px
color: var(--red-500), glow: var(--glow-red-sm)
animation: flash 400ms infinite
```

---

### 7.5 Circular 3D Skill Button

The primary interactive gameplay element. Four instances, one per canonical skill.

**Base sizing**:
```
Default diameter:  140px
Emphasized:        175px  (when skill is the stage's focus)
```

**Position**: Y 1560–1760, distributed horizontally:
- 4 buttons: x centers at 162, 378, 702, 918 (gap ~30px between edges)
- Emphasized center variant: 1 larger at x=540, 3 smaller flanking

**Props**:
```ts
interface SkillButtonProps {
  skill: 'orbital-cut' | 'solar-lance' | 'gravity-slow' | 'delta-shield';
  state: 'idle' | 'ready' | 'cooldown' | 'disabled';
  cooldownProgress: number;  // 0.0 (just used) → 1.0 (ready)
  cooldownSeconds: number;   // remaining seconds to display
  energyAvailable: boolean;
  onActivate: () => void;
}
```

**Skill → color mapping**:
| Skill | Primary color | Glow token |
|-------|--------------|------------|
| Orbital Cut | `--skill-orbital-cut` (#22d3ee) | `--glow-cyan-md` |
| Solar Lance | `--skill-solar-lance` (#f59e0b) | `--glow-gold-md` |
| Gravity Slow | `--skill-gravity-slow` (#a855f7) | `--glow-purple-md` |
| Delta Shield | `--skill-delta-shield` (#a5f3fc) | `--glow-cyan-sm` |

**Visual structure (layers from back to front)**:
```
1. Outer ring glow         — skill color, 4px wide, radius = (d/2)+4, opacity driven by state
2. Radial cooldown track   — dark arc, stroke 6px
3. Radial cooldown fill    — skill color arc, stroke 6px, sweeps clockwise on cooldown
4. Button shell            — circle, glossy 3D bevel gradient:
     background: radial-gradient(circle at 38% 28%, <light-skill-color>, <mid-skill-color>, <dark-skill-color>)
     box-shadow: var(--shadow-button), inner highlight at top-left
5. Skill icon sprite       — 60×60px centered PNG/WebP
6. Cooldown number         — center text, only when state=cooldown
7. Pulse ring              — animated expand ring, only when state=ready
```

**State styles**:

*idle* (gauge not full / not ready):
```css
opacity: 0.75;
filter: brightness(0.7);
/* outer ring: opacity 0.3 */
```

*ready* (can activate):
```css
opacity: 1;
filter: brightness(1);
/* outer ring: full opacity */
/* pulse ring animation: */
@keyframes skill-pulse {
  0%   { transform: scale(1.0); opacity: 0.8; }
  70%  { transform: scale(1.18); opacity: 0; }
  100% { transform: scale(1.18); opacity: 0; }
}
animation: skill-pulse var(--dur-pulse) ease-out infinite;
```

*cooldown* (sweeping radial progress):
```css
opacity: 0.65;
/* arc fill: animates from 0 → 2π as cooldown recovers */
/* center text: remaining seconds, --text-hud-md, white */
/* outer ring: opacity 0.2 */
```

*disabled* (cannot use, insufficient energy):
```css
opacity: 0.4;
filter: grayscale(0.5) brightness(0.5);
cursor: not-allowed;
```

**Press interaction**:
```css
&:active {
  transform: scale(var(--btn-press-scale));
  transition: transform var(--btn-press-dur) ease-in;
}
/* release */
transform: scale(1.0);
transition: transform var(--btn-release-dur) var(--btn-release-ease);
```

---

### 7.6 Mode Card

Used in home screen mode selection grid (3 cols × 2 rows).

**Size**: 300×170 px. Grid: startX=60, startY=1160, gap=30.

**Props**:
```ts
interface ModeCardProps {
  mode: 'story' | 'free-defense' | 'ranked' | 'boss-rush' | '60s-blitz' | 'daily';
  icon: string;         // sprite path
  title: string;        // i18n key
  subtitle: string;     // i18n key (status / tagline)
  progress?: string;    // e.g. "48/180" for story
  locked?: boolean;
}
```

**Color per mode**:
| Mode | `--mode-*` | Border glow |
|------|-----------|-------------|
| Story | `--mode-story` (#3b82f6) | `--glow-cyan-sm` |
| Free Defense | `--mode-free-defense` (#10b981) | `--glow-green-sm` |
| Ranked | `--mode-ranked` (#7c3aed) | `--glow-purple-sm` |
| Boss Rush | `--mode-boss-rush` (#dc2626) | `--glow-red-sm` |
| 60s Blitz | `--mode-60s-blitz` (#06b6d4) | `--glow-cyan-sm` |
| Daily | `--mode-daily` (#f59e0b) | `--glow-gold-sm` |

**Card structure**:
```
background: linear-gradient(135deg, var(--navy-800) 0%, var(--navy-700) 100%)
border: 1px solid <mode-color at 40% opacity>
border-radius: var(--radius-xl)
box-shadow: var(--shadow-panel), <mode-glow at 50% opacity>
padding: 16px

[ Mode icon 48×48   ] [ Title --text-heading ]
                       [ Subtitle --text-body-sm --text-muted ]
[ Progress bar (opt)  — full width, 6px h, mode-color fill ]
```

**Tilt effect** (React Bits GlowingCard / TiltCard — menu only):
- Max tilt: ±8deg on touch/hover
- Glow tracks pointer position
- Disabled when `prefers-reduced-motion`

**Locked state**: full overlay `--black-alpha-60` + lock icon centered.

---

### 7.7 START Button

**Size**: 720×130 px. Position: x=180, y=980 (centered at x=540).

```css
background: linear-gradient(135deg, var(--gold-600) 0%, var(--gold-400) 50%, var(--gold-300) 100%);
border-radius: var(--radius-xl);
border: 2px solid var(--gold-300);
box-shadow: var(--shadow-button), var(--glow-gold-md);

font: var(--text-heading) / var(--font-display);
font-weight: 800;
letter-spacing: 0.12em;
text-transform: uppercase;
color: var(--navy-950);  /* dark text on gold — high contrast */

/* light sweep animation */
&::after {
  content: '';
  position: absolute;
  width: 60px; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
  animation: btn-sweep var(--dur-sweep) ease-in-out infinite;
  animation-delay: 2s;
}
@keyframes btn-sweep {
  0%   { left: -60px; }
  100% { left: 100%; }
}
```

**Press state**:
```css
transform: scale(var(--btn-press-scale)) translateY(2px);
box-shadow: var(--glow-gold-sm);  /* reduced glow on press */
```

**i18n text**: `t('home.start')` → "START" / "시작"

---

### 7.8 Mission Panel

Appears in gameplay screens with mission objectives (Story stages).

**Size**: ~480×200 px (flexible height). Position: overlay at Y ~260, x=60 or centered.

```css
background: var(--bg-overlay);
border: 1px solid var(--border-panel);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-panel);
padding: var(--space-2) var(--space-3);
```

**Structure**:
```
MISSION (label)
[ icon ] Protect rescue shuttle       [✓/✗]
[ icon ] Protect all capsules   4/5   [✓/✗]
[ icon ] Defeat all meteors    12/25  [✓/✗]
```
Each row: icon 24×24 / body text --text-body-sm / counter --font-hud bold / status icon.
Complete: `--green-400`. Failed: `--red-500`. Pending: `--white-300`.

---

### 7.9 Boss HP Bar

Visible only in boss stages. Replaces center HUD score with boss name + HP.

**Position**: Y 80–130, x=300 w=480 (center HUD area).

```
[ Boss Name  --text-hud-sm gold ] [ x12 multiplier badge ]
[ HP bar: 8.45M / 12M           ]
```

**HP bar**:
```css
width: 480px; height: 18px;
background: var(--navy-600);
border-radius: var(--radius-pill);
border: 1px solid var(--red-700);

/* fill */
background: linear-gradient(90deg, var(--red-700), var(--lava-500));
box-shadow: var(--glow-orange-sm);
transition: width 150ms ease-out;

/* low HP (<25%) */
background: linear-gradient(90deg, var(--red-600), var(--red-500));
animation: hp-pulse 800ms ease-in-out infinite;
```

HP value text: `--font-hud` / `--text-hud-sm` / `--text-secondary`. Format: `8.45M / 12M`.

---

### 7.10 Combo Box

Floating element, appears when combo ≥ 2.

**Size**: ~160×60 px. Position: floats near earth, Y ~1350 (above skill bar, below play field mid).

```
[ COMBO x18 ] — or Korean: [ 콤보 x18 ]
```

```css
background: rgba(8, 14, 36, 0.75);
border: 1px solid var(--orange-500);
border-radius: var(--radius-md);
box-shadow: var(--glow-orange-sm);
padding: 8px 16px;

/* value */
font: 48px / var(--font-hud);
font-weight: 800;
color: var(--combo-color);

/* multiplier badge (≥ 5 combo) */
/* shown alongside: ×1.2, ×1.5, ×2.0, ×2.5 */
color: var(--combo-max);
```

**Pop animation** on increment:
```css
@keyframes combo-pop {
  0%   { transform: scale(1.0); }
  40%  { transform: scale(1.35); }
  100% { transform: scale(1.0); }
}
animation: combo-pop var(--dur-combo-pop) var(--ease-out-back);
```

**Decay**: fades out after 3s without new hit. `opacity: 0` over 400ms.

---

### 7.11 Last Save Banner

Dramatic, short-lived. Appears on successful Last Save zone kill.

**Size**: full width banner, height 90 px. Position: Y ~1480 (above skill bar).

```css
background: linear-gradient(90deg,
  transparent,
  rgba(251, 191, 36, 0.2) 20%,
  rgba(251, 191, 36, 0.3) 50%,
  rgba(251, 191, 36, 0.2) 80%,
  transparent);
border-top:    1px solid rgba(251, 191, 36, 0.6);
border-bottom: 1px solid rgba(251, 191, 36, 0.6);
```

**Text**: `LAST SAVE!` / `지구 직전 방어!`
```css
font: var(--text-impact) / var(--font-display);
font-weight: 800;
color: var(--last-save-color);
text-shadow: var(--glow-gold-md);
letter-spacing: 0.1em;
text-transform: uppercase;
```

**Lifecycle**:
```
appear: slide-in from right + fade-in, 150ms ease-out
hold: 600ms
dismiss: fade-out 200ms
```

Score multiplier badge appears adjacent: `×3.5` in gold.

---

### 7.12 Result Dialog — Victory

**Trigger**: stage/mode completion success.

**Size**: 900×1100 px, centered. Backdrop: `--bg-overlay` full screen.

```css
background: linear-gradient(180deg, var(--navy-700) 0%, var(--navy-800) 100%);
border: 1px solid rgba(34, 211, 238, 0.4);
border-radius: var(--radius-2xl);
box-shadow: var(--shadow-dialog), var(--glow-cyan-md);
padding: var(--space-8) var(--space-6);
```

**Sections** (top to bottom):
```
[ VICTORY / 승리 ]          — --text-impact / gold / glow-gold-md
[ Star rating 1–3 ★ ]       — 3 stars, filled=gold empty=gray-600
[ Final Score: 125,480 ]    — --text-hud-xl / white / CountUp animation 1200ms
[ Survival time / Mode KPI ] — --text-hud-md / white-300
[ Stats grid 2×2 ]           — combo/slashes/last-saves/accuracy, --text-body-sm
[ Share rank badge (opt) ]
[ CTA: CONTINUE / 계속  ]   — gold START-button style, 680×110px
[ Secondary: RETRY / 다시 ] — outlined, --electric-400 border, 680×90px
```

**Enter animation**: scale 0.85→1 + fade-in, 220ms `--ease-out-back`.

---

### 7.13 Result Dialog — Game Over

**Trigger**: Earth Energy reaches 0.

**Size**: 900×1000 px, centered. Backdrop: `--bg-overlay` with red tint `rgba(220,38,38,0.1)`.

```css
background: linear-gradient(180deg, #1a0a0a 0%, var(--navy-800) 100%);
border: 1px solid rgba(239, 68, 68, 0.5);
border-radius: var(--radius-2xl);
box-shadow: var(--shadow-dialog), var(--glow-red-sm);
```

**Sections**:
```
[ GAME OVER / 게임 오버 ]   — --text-impact / red-500 / glow-red-sm
[ Earth energy at end ]       — energy bar at 0
[ Final Score: 88,250 ]       — --text-hud-xl / white
[ Survival time ]             — --text-hud-md / white-300
[ Personal best comparison ]  — "New Record!" gold if PB, else diff from PB
[ Stats 2×2 ]
[ CTA: RETRY / 다시 도전 ]   — --mode-ranked / --electric-500 bg
[ Secondary: HOME / 홈 ]     — text button, white-300
[ Ad button if applicable ]  — "광고 보고 재도전" / --gold-400 outlined
```

---

### 7.14 Settings Button

**Size**: 120×120 px. Position: Y ~1740, x=60 (bottom-left).

```css
background: var(--bg-surface);
border: 1px solid var(--border-panel);
border-radius: var(--radius-xl);
box-shadow: var(--shadow-button);
/* icon: gear SVG, 48×48, color var(--text-secondary) */
```

**States**: default / hover (border brightens) / pressed (scale 0.93).

---

### 7.15 Collection Button

**Size**: 120×120 px. Position: Y ~1740, x=900 (bottom-right).

Same style as Settings Button. Icon: trophy/badge SVG.
Badge count overlay: 20×20px circle, `--gold-400` bg, `--navy-950` text.

---

## 8. Layer Stack (Implementation Reference)

from design-plan §10 — implementer must honor this z-order:

```
L0  bg-space              z: 0      PixiJS: bg container
L1  far-stars-nebula      z: 10     PixiJS: particle/sprite
L2  orbit-guide-lines     z: 20     PixiJS: graphics (very faint)
L3  enemy-trails          z: 30     PixiJS: particle
L4  enemies               z: 40     PixiJS: sprites
L5  friendly-objects      z: 50     PixiJS: sprites
L6  earth-shield-outer    z: 60     PixiJS: graphics/sprite
L7  earth                 z: 70     PixiJS: sprite
L8  earth-shield-fg       z: 80     PixiJS: graphics (hex grid pulse)
L9  slash-trail-skill-vfx z: 90     PixiJS: graphics/particle
L10 damage-explosion      z: 100    PixiJS: particle
L11 hud-panels            z: 200    HTML overlay (position: fixed)
L12 hud-text              z: 210    HTML overlay
L13 tutorial-warning      z: 220    HTML overlay
```

**Rule**: L0–L10 = PixiJS Canvas. L11–L13 = HTML/CSS overlay (pointer-events:
none during gameplay except skill buttons and pause). Skill buttons sit at
L11-equivalent in the HTML layer, positioned at Y 1560–1760.

---

## 9. Earth Visual States (Reference)

Ties design tokens to gameplay states for renderer implementation.

| Energy | Shield color | Shield opacity | Hex grid | Screen edge |
|--------|-------------|----------------|----------|-------------|
| 100–70 | `--earth-healthy` | 0.85 | visible, pulse slow | none |
| 69–40 | `--earth-cracked` | 0.7 | crack texture overlay | none |
| 39–10 | `--earth-danger` | 0.5 (red tint) | broken pattern | red vignette |
| < 10 | `--earth-critical` | 0.3, flash | barely visible | red flash pulse |

Earth body diameter in gameplay: **300 px** (design-plan canonical value within
the 280–330 range). Shield: **420 px**. Last Save ring: **520 px**.
These values NEVER scale up during normal gameplay; only the global canvas
scale factor applies.

---

## 10. Open Questions for Owner

1. **Font licensing**: Exo 2, Rajdhani, and Orbitron are Google Fonts (free).
   Confirm whether a licensed commercial typeface is preferred for the logo /
   display text, or Google Fonts are acceptable for the Apps in Toss WebView
   target.

2. **Skill icon sprites**: design_sample asset pack (07) has VFX, but individual
   circular button icon sprites for the 4 canonical skills are not confirmed as
   final assets. Confirm whether Owner will supply custom icons or whether we
   derive them from the sample VFX sprites.

3. **60s Blitz mode card color**: design-plan says "시안 (cyan)". This overlaps
   with Orbital Cut skill color and the Earth shield color family. Recommend
   keeping it distinct — suggest `--ice-500` (#7dd3fc) as a slightly lighter
   cyan variant. Confirm or override.

4. **Korean "지구 직전 방어!" banner truncation**: at --text-impact size (52–72px)
   on 1080px width, the 9-character Korean string fits fine, but at the smallest
   clamp value (44px) it remains safe. No action needed unless Owner wants a
   different label.

5. **React Bits install approval**: confirm whether any of the 3 candidate
   components (GlowingCard tilt, CountUp number ticker, Animated gradient border)
   are approved for initial implementation, or defer to a later design-polish pass.
