/**
 * Keeps simulation paused after a background transition until the player
 * explicitly resumes. Browser visibility events are adapted by GameApp.
 */
export class AppLifecycle {
  private visible = true;
  private requiresResume = false;

  hidden(): void {
    this.visible = false;
    this.requiresResume = true;
  }

  shown(): void {
    this.visible = true;
  }

  resume(): void {
    if (this.visible) this.requiresResume = false;
  }

  canAdvance(): boolean {
    return this.visible && !this.requiresResume;
  }

  resumeRequired(): boolean {
    return this.requiresResume;
  }
}
