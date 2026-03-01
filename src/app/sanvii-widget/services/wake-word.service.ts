import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { SettingsService } from './settings.service';
import { SoundService } from './sound.service';

@Injectable({ providedIn: 'root' })
export class WakeWordService {

  wakeWordDetected$ = new Subject<void>();

  private recognition: any;
  private isRunning = false;
  private restartTimeout: any;

  constructor(
    private zone: NgZone,
    private settings: SettingsService,
    private sound: SoundService
  ) {}

  start(): void {
    if (!this.settings.get('wakeWordEnabled')) return;

    const SR = (window as any).SpeechRecognition ||
               (window as any).webkitSpeechRecognition;
    if (!SR) return;

    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.settings.get('language');

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();

        if (
          transcript.includes('hey sanvii') ||
          transcript.includes('sanvii') ||
          transcript.includes('hey sunny') ||
          transcript.includes('hey siri') // close enough phonetically
        ) {
          this.zone.run(() => {
            this.sound.play('wake');
            this.wakeWordDetected$.next();
          });

          // Stop and restart to avoid double triggers
          this.stop();
          setTimeout(() => this.start(), 3000);
          return;
        }
      }
    };

    this.recognition.onend = () => {
      // Auto restart if still enabled
      if (this.isRunning && this.settings.get('wakeWordEnabled')) {
        this.restartTimeout = setTimeout(() => this.startRecognition(), 500);
      }
    };

    this.recognition.onerror = () => {
      if (this.isRunning) {
        this.restartTimeout = setTimeout(() => this.startRecognition(), 1000);
      }
    };

    this.isRunning = true;
    this.startRecognition();
  }

  stop(): void {
    this.isRunning = false;
    clearTimeout(this.restartTimeout);
    try { this.recognition?.stop(); } catch {}
  }

  toggle(): void {
    if (this.isRunning) {
      this.stop();
      this.settings.set('wakeWordEnabled', false);
    } else {
      this.settings.set('wakeWordEnabled', true);
      this.start();
    }
  }

  private startRecognition(): void {
    try {
      this.recognition?.start();
    } catch {}
  }
}