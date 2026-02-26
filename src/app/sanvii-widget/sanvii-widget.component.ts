import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'sanvii-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sanvii-widget.component.html',
  styleUrls: ['./sanvii-widget.component.scss']
})
export class SanviiWidgetComponent {
  isOpen = false;

  toggleChat() {
    this.isOpen = !this.isOpen;
  }
}