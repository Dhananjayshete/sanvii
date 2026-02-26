import { Component } from '@angular/core';
import { SanviiWidgetComponent } from './sanvii-widget/sanvii-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SanviiWidgetComponent],
  template: `<sanvii-widget></sanvii-widget>`
})
export class AppComponent {}