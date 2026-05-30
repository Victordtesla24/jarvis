// SILENCED per the hard no-voice / no-sound mandate (design_refs/HOLOGRAPHIC.md).
// Same public API as the original, but every method is a no-op — the dashboard
// never plays audio, speech, or any sound. Do NOT re-add audio here.
export class SoundService {
  private static context: AudioContext | null = null;
  private static gainNode: GainNode | null = null;

  static initialize(): void {}
  static speak(_text: string): void {}
  static playBlip(): void {}
  static playLock(): void {}
  static playRelease(): void {}
  static playServo(_intensity: number): void {}
  static playMapSwitch(): void {}
  static playAmbientHum(): void {}
  static playBootSequence(): void {}
}
