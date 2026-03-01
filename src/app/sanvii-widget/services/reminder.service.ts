import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { SanviiReminder } from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class ReminderService {

  private readonly KEY = 'sanvii_reminders';
  private checkInterval: any;

  reminderFired$ = new Subject<SanviiReminder>();

  constructor(private zone: NgZone) {
    this.startChecker();
  }

  private getAll(): SanviiReminder[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  }

  private saveAll(reminders: SanviiReminder[]): void {
    localStorage.setItem(this.KEY, JSON.stringify(reminders));
  }

  addReminder(message: string, time: Date): SanviiReminder {
    const reminder: SanviiReminder = {
      id: this.genId(),
      message,
      time: time.getTime(),
      timeStr: time.toLocaleString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
        month: 'short', day: 'numeric'
      }),
      active: true,
      fired: false
    };

    const all = this.getAll();
    all.push(reminder);
    this.saveAll(all);

    return reminder;
  }

  removeReminder(id: string): void {
    const all = this.getAll().filter(r => r.id !== id);
    this.saveAll(all);
  }

  getActiveReminders(): SanviiReminder[] {
    return this.getAll().filter(r => r.active && !r.fired);
  }

  getAllReminders(): SanviiReminder[] {
    return this.getAll();
  }

  clearAll(): void {
    localStorage.removeItem(this.KEY);
  }

  // Parse time from natural language
  parseTime(text: string): Date | null {
    const now = new Date();
    const lower = text.toLowerCase();

    // "in X minutes"
    const minMatch = lower.match(/in (\d+) min/);
    if (minMatch) {
      return new Date(now.getTime() + parseInt(minMatch[1]) * 60000);
    }

    // "in X hours"
    const hourMatch = lower.match(/in (\d+) hour/);
    if (hourMatch) {
      return new Date(now.getTime() + parseInt(hourMatch[1]) * 3600000);
    }

    // "at X PM/AM"
    const atMatch = lower.match(/at (\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (atMatch) {
      let hour = parseInt(atMatch[1]);
      const min = parseInt(atMatch[2] || '0');
      const ampm = atMatch[3]?.toLowerCase();

      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;

      const target = new Date(now);
      target.setHours(hour, min, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      return target;
    }

    // "tomorrow"
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (timeMatch) {
        let h = parseInt(timeMatch[1]);
        const m = parseInt(timeMatch[2] || '0');
        const ap = timeMatch[3]?.toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        tomorrow.setHours(h, m, 0, 0);
      } else {
        tomorrow.setHours(9, 0, 0, 0);
      }
      return tomorrow;
    }

    // "in X seconds" (for testing)
    const secMatch = lower.match(/in (\d+) sec/);
    if (secMatch) {
      return new Date(now.getTime() + parseInt(secMatch[1]) * 1000);
    }

    return null;
  }

  // Check for due reminders every 10 seconds
  private startChecker(): void {
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      const all = this.getAll();
      let changed = false;

      all.forEach(r => {
        if (r.active && !r.fired && r.time <= now) {
          r.fired = true;
          r.active = false;
          changed = true;
          this.zone.run(() => this.reminderFired$.next(r));
        }
      });

      if (changed) this.saveAll(all);
    }, 10000);
  }

  private genId(): string {
    return 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }
}