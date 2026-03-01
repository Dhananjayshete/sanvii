import { Injectable } from '@angular/core';
import { SanviiTodo } from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class TodoService {

  private readonly KEY = 'sanvii_todos';

  getAll(): SanviiTodo[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  }

  private save(todos: SanviiTodo[]): void {
    localStorage.setItem(this.KEY, JSON.stringify(todos));
  }

  add(text: string): SanviiTodo {
    const todo: SanviiTodo = {
      id: 'todo_' + Date.now(),
      text,
      done: false,
      createdAt: Date.now()
    };

    const all = this.getAll();
    all.push(todo);
    this.save(all);
    return todo;
  }

  complete(idOrText: string): SanviiTodo | null {
    const all = this.getAll();
    const item = all.find((t: SanviiTodo) =>
      t.id === idOrText ||
      t.text.toLowerCase().includes(idOrText.toLowerCase())
    );

    if (item) {
      item.done = true;
      item.completedAt = Date.now();
      this.save(all);
    }

    return item || null;
  }

  remove(idOrText: string): boolean {
    const all = this.getAll();
    const idx = all.findIndex((t: SanviiTodo) =>
      t.id === idOrText ||
      t.text.toLowerCase().includes(idOrText.toLowerCase())
    );

    if (idx >= 0) {
      all.splice(idx, 1);
      this.save(all);
      return true;
    }
    return false;
  }

  getPending(): SanviiTodo[] {
    return this.getAll().filter((t: SanviiTodo) => !t.done);
  }

  getCompleted(): SanviiTodo[] {
    return this.getAll().filter((t: SanviiTodo) => t.done);
  }

  clearCompleted(): void {
    this.save(this.getPending());
  }

  clearAll(): void {
    localStorage.removeItem(this.KEY);
  }

  getFormattedList(): string {
    const todos = this.getAll();
    if (todos.length === 0) return 'Your to-do list is empty!';

    return todos.map((t: SanviiTodo) =>
      `${t.done ? '✅' : '☐'} ${t.text}`
    ).join('\n');
  }

  getTodayCompleted(): number {
    const today = new Date().toDateString();
    return this.getAll().filter((t: SanviiTodo) =>
      t.done && t.completedAt &&
      new Date(t.completedAt).toDateString() === today
    ).length;
  }
}