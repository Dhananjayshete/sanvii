import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class SoundService {

  private audioCtx: AudioContext | null = null;

  constructor(private settings: SettingsService) {}

  private getCtx(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    return this.audioCtx;
  }

  play(type: 'listen-start' | 'listen-stop' | 'message' | 'success' | 'error' | 'notification' | 'wake'): void {
    if (!this.settings.get('soundEffects')) return;

    const ctx = this.getCtx();

    switch (type) {
      case 'listen-start':
        this.playTone(ctx, 800, 0.1, 0.15, 'sine');
        setTimeout(() => this.playTone(ctx, 1200, 0.1, 0.12, 'sine'), 100);
        break;

      case 'listen-stop':
        this.playTone(ctx, 1200, 0.1, 0.12, 'sine');
        setTimeout(() => this.playTone(ctx, 800, 0.1, 0.12, 'sine'), 100);
        break;

      case 'message':
        this.playTone(ctx, 600, 0.08, 0.1, 'sine');
        break;

      case 'success':
        this.playTone(ctx, 523, 0.1, 0.15, 'sine');
        setTimeout(() => this.playTone(ctx, 659, 0.1, 0.15, 'sine'), 120);
        setTimeout(() => this.playTone(ctx, 784, 0.15, 0.15, 'sine'), 240);
        break;

      case 'error':
        this.playTone(ctx, 300, 0.15, 0.15, 'square');
        setTimeout(() => this.playTone(ctx, 250, 0.2, 0.15, 'square'), 150);
        break;

      case 'notification':
        this.playTone(ctx, 880, 0.12, 0.2, 'sine');
        setTimeout(() => this.playTone(ctx, 1100, 0.12, 0.18, 'sine'), 150);
        setTimeout(() => this.playTone(ctx, 880, 0.12, 0.15, 'sine'), 300);
        break;

      case 'wake':
        this.playTone(ctx, 440, 0.1, 0.15, 'sine');
        setTimeout(() => this.playTone(ctx, 554, 0.1, 0.15, 'sine'), 100);
        setTimeout(() => this.playTone(ctx, 659, 0.15, 0.18, 'sine'), 200);
        break;
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    duration: number,
    volume: number,
    type: OscillatorType
  ): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume;

      // Fade out
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }
}