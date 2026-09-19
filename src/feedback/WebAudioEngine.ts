import { AUDIO_MANIFEST } from "./AudioManifest";
import type { AudioPort, FeedbackCue } from "./AudioPort";

interface OscillatorLike {
  type: string;
  frequency: { value: number };
  connect(target: unknown): void;
  start(at?: number): void;
  stop(at?: number): void;
}

interface GainLike {
  gain: {
    setValueAtTime(value: number, at: number): void;
    exponentialRampToValueAtTime(value: number, at: number): void;
  };
  connect(target: unknown): void;
}

interface AudioContextLike {
  destination: unknown;
  currentTime: number;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

type ContextFactory = () => AudioContextLike | null;
type AudioElementFactory = () => HtmlAudioElementLike | null;

export interface HtmlAudioElementLike {
  src: string;
  loop: boolean;
  preload: string;
  volume: number;
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
}

const BGM_SOURCE = "/assets/audio/orbit-siege-120s.m4a";
const BGM_VOLUME = 0.28;

/** Browser audio: gesture-gated WebAudio cues plus a pre-rendered BGM track. */
export class WebAudioEngine implements AudioPort {
  private context: AudioContextLike | null = null;
  private unlocked = false;
  private bgmEnabled = false;
  private bgmAudio: HtmlAudioElementLike | null = null;
  private bgmPlaying = false;
  private bgmPlaybackRequested = false;
  private bgmPlaybackEpoch = 0;
  private bgmPlayAttempt: Promise<boolean> | null = null;

  constructor(
    private readonly createContext: ContextFactory = browserAudioContext,
    private readonly createAudioElement: AudioElementFactory = browserAudioElement,
  ) {}

  attemptAutoplay(): Promise<boolean> {
    if (!this.bgmEnabled) return Promise.resolve(false);
    this.requestBgmPlayback();
    if (this.bgmPlaying) return Promise.resolve(true);
    if (this.bgmPlayAttempt) return this.bgmPlayAttempt;

    const audio = this.getBgmAudio();
    if (!audio) return Promise.resolve(false);

    let playResult: Promise<void>;
    try {
      playResult = audio.play();
    } catch {
      return Promise.resolve(false);
    }

    const attemptEpoch = this.bgmPlaybackEpoch;
    let attemptSucceeded = false;
    const attempt = playResult.then(
      () => {
        if (!this.bgmEnabled || !this.bgmPlaybackRequested) {
          audio.pause();
          this.bgmPlaying = false;
          return false;
        }
        attemptSucceeded = true;
        this.bgmPlaying = true;
        return true;
      },
      () => {
        this.bgmPlaying = false;
        return false;
      },
    );
    this.bgmPlayAttempt = attempt;
    void attempt.finally(() => {
      if (this.bgmPlayAttempt !== attempt) return;
      this.bgmPlayAttempt = null;
      if (
        !attemptSucceeded
        && this.bgmEnabled
        && this.bgmPlaybackRequested
        && this.bgmPlaybackEpoch !== attemptEpoch
      ) {
        void this.attemptAutoplay();
      }
    });
    return attempt;
  }

  unlockFromUserGesture(): void {
    this.unlocked = true;
    this.context ??= this.createContext();
    void this.context?.resume().catch(() => undefined);
    if (this.bgmEnabled) void this.attemptAutoplay();
  }

  setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    if (!enabled) {
      this.cancelBgmPlaybackRequest();
      this.pauseBgm();
      return;
    }
    this.requestBgmPlayback();
    void this.attemptAutoplay();
  }

  play(cue: FeedbackCue): void {
    if (!this.unlocked || !this.context) return;
    const spec = AUDIO_MANIFEST[cue];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = cue === "friendly_hit" || cue.startsWith("boss_") ? "triangle" : "sine";
    oscillator.frequency.value = spec.frequencyHz;
    gain.gain.setValueAtTime(spec.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + spec.durationMs / 1000);
  }

  pause(): void {
    this.cancelBgmPlaybackRequest();
    this.pauseBgm();
  }

  private requestBgmPlayback(): void {
    if (this.bgmPlaybackRequested) return;
    this.bgmPlaybackRequested = true;
    this.bgmPlaybackEpoch += 1;
  }

  private cancelBgmPlaybackRequest(): void {
    if (!this.bgmPlaybackRequested) return;
    this.bgmPlaybackRequested = false;
    this.bgmPlaybackEpoch += 1;
  }

  private getBgmAudio(): HtmlAudioElementLike | null {
    if (this.bgmAudio) return this.bgmAudio;
    const audio = this.createAudioElement();
    if (!audio) return null;
    audio.src = BGM_SOURCE;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = BGM_VOLUME;
    audio.currentTime = 0;
    this.bgmAudio = audio;
    return audio;
  }

  private pauseBgm(): void {
    this.bgmAudio?.pause();
    this.bgmPlaying = false;
  }
}

function browserAudioContext(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

function browserAudioElement(): HtmlAudioElementLike | null {
  return typeof Audio === "undefined" ? null : new Audio();
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
