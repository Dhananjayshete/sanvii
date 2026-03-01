import { Injectable } from '@angular/core';
import { SanviiNote } from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class NotesService {

  private readonly KEY = 'sanvii_notes';

  getAll(): SanviiNote[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  }

  private save(notes: SanviiNote[]): void {
    localStorage.setItem(this.KEY, JSON.stringify(notes));
  }

  add(text: string, tags?: string[]): SanviiNote {
    const note: SanviiNote = {
      id: 'note_' + Date.now(),
      text,
      createdAt: Date.now(),
      tags
    };

    const all = this.getAll();
    all.unshift(note); // newest first
    this.save(all);
    return note;
  }

  remove(id: string): boolean {
    const all = this.getAll();
    const idx = all.findIndex(n => n.id === id);
    if (idx >= 0) {
      all.splice(idx, 1);
      this.save(all);
      return true;
    }
    return false;
  }

  search(query: string): SanviiNote[] {
    return this.getAll().filter(n =>
      n.text.toLowerCase().includes(query.toLowerCase())
    );
  }

  getLatest(n = 5): SanviiNote[] {
    return this.getAll().slice(0, n);
  }

  getFormatted(): string {
    const notes = this.getAll();
    if (notes.length === 0) return 'No notes saved yet!';

    return notes.slice(0, 10).map((n, i) => {
      const date = new Date(n.createdAt).toLocaleDateString();
      return `${i + 1}. ${n.text} (${date})`;
    }).join('\n');
  }

  copyToClipboard(noteId?: string): string {
    const notes = this.getAll();
    const note = noteId
      ? notes.find(n => n.id === noteId)
      : notes[0];

    if (note) {
      navigator.clipboard.writeText(note.text).catch(() => {});
      return note.text;
    }
    return '';
  }

  clearAll(): void {
    localStorage.removeItem(this.KEY);
  }
}