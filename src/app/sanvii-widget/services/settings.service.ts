import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SanviiSettings, DEFAULT_SETTINGS } from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class SettingsService {

  private readonly KEY = 'sanvii_settings';
  private settings: SanviiSettings;

  settings$ = new BehaviorSubject<SanviiSettings>(DEFAULT_SETTINGS);

  constructor() {
    this.settings = this.load();
    this.settings$.next(this.settings);
  }

  private load(): SanviiSettings {
    try {
      const saved = localStorage.getItem(this.KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    localStorage.setItem(this.KEY, JSON.stringify(this.settings));
    this.settings$.next({ ...this.settings });
  }

  get<K extends keyof SanviiSettings>(key: K): SanviiSettings[K] {
    return this.settings[key];
  }

  set<K extends keyof SanviiSettings>(key: K, value: SanviiSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  getAll(): SanviiSettings {
    return { ...this.settings };
  }

  updateMultiple(partial: Partial<SanviiSettings>): void {
    Object.assign(this.settings, partial);
    this.save();
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }
}