import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SettingsService } from './settings.service';

export interface ThemeColors {
  name: string;
  primary: string;
  primaryDark: string;
  accent: string;
  bgChat: string;
  bgCard: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  gradient: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private themes: Record<string, ThemeColors> = {
    dark: {
      name: 'Dark',
      primary: '#6a11cb',
      primaryDark: '#4a0e8f',
      accent: '#2575fc',
      bgChat: '#1a1a2e',
      bgCard: '#16213e',
      bgInput: '#0f3460',
      textPrimary: '#e2e8f0',
      textSecondary: '#94a3b8',
      gradient: 'linear-gradient(135deg, #6a11cb, #2575fc)'
    },
    light: {
      name: 'Light',
      primary: '#6a11cb',
      primaryDark: '#4a0e8f',
      accent: '#2575fc',
      bgChat: '#f8fafc',
      bgCard: '#ffffff',
      bgInput: '#f1f5f9',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      gradient: 'linear-gradient(135deg, #6a11cb, #2575fc)'
    },
    ocean: {
      name: 'Ocean Blue',
      primary: '#0077b6',
      primaryDark: '#023e8a',
      accent: '#00b4d8',
      bgChat: '#0a1628',
      bgCard: '#112240',
      bgInput: '#1a365d',
      textPrimary: '#caf0f8',
      textSecondary: '#90e0ef',
      gradient: 'linear-gradient(135deg, #023e8a, #00b4d8)'
    },
    sakura: {
      name: 'Sakura Pink',
      primary: '#e91e8c',
      primaryDark: '#b5179e',
      accent: '#f72585',
      bgChat: '#2d1b30',
      bgCard: '#3d1f42',
      bgInput: '#4a2050',
      textPrimary: '#fce4ec',
      textSecondary: '#f8bbd0',
      gradient: 'linear-gradient(135deg, #b5179e, #f72585)'
    },
    ember: {
      name: 'Ember Red',
      primary: '#dc2626',
      primaryDark: '#991b1b',
      accent: '#f97316',
      bgChat: '#1c1010',
      bgCard: '#2d1515',
      bgInput: '#3d1c1c',
      textPrimary: '#fef2f2',
      textSecondary: '#fca5a5',
      gradient: 'linear-gradient(135deg, #991b1b, #f97316)'
    },
    forest: {
      name: 'Forest Green',
      primary: '#059669',
      primaryDark: '#065f46',
      accent: '#10b981',
      bgChat: '#0a1f18',
      bgCard: '#122b21',
      bgInput: '#1a3a2c',
      textPrimary: '#d1fae5',
      textSecondary: '#6ee7b7',
      gradient: 'linear-gradient(135deg, #065f46, #10b981)'
    }
  };

  currentTheme$ = new BehaviorSubject<ThemeColors>(this.themes['dark']);

  constructor(private settings: SettingsService) {
    this.applyTheme(this.settings.get('theme'));

    // Auto dark/light based on time
    this.checkAutoTheme();
  }

  getThemeList(): { key: string; name: string }[] {
    return Object.entries(this.themes).map(([key, val]) => ({
      key,
      name: val.name
    }));
  }

  applyTheme(themeKey: string): void {
    const theme = this.themes[themeKey] || this.themes['dark'];
    this.currentTheme$.next(theme);

    // Apply CSS variables to document
    const root = document.documentElement;
    root.style.setProperty('--sanvii-primary', theme.primary);
    root.style.setProperty('--sanvii-primary-dark', theme.primaryDark);
    root.style.setProperty('--sanvii-accent', theme.accent);
    root.style.setProperty('--sanvii-bg-chat', theme.bgChat);
    root.style.setProperty('--sanvii-bg-card', theme.bgCard);
    root.style.setProperty('--sanvii-bg-input', theme.bgInput);
    root.style.setProperty('--sanvii-text-primary', theme.textPrimary);
    root.style.setProperty('--sanvii-text-secondary', theme.textSecondary);
    root.style.setProperty('--sanvii-gradient', theme.gradient);

    this.settings.set('theme', themeKey);
  }

  private checkAutoTheme(): void {
    const hour = new Date().getHours();
    const current = this.settings.get('theme');

    // Only auto-switch if user hasn't set a custom theme
    if (current === 'dark' || current === 'light') {
      if (hour >= 7 && hour < 19) {
        // Day time — keep user preference
      } else {
        // Night — ensure dark
      }
    }
  }
}