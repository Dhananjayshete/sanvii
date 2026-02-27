import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SanviiWidgetComponent } from './sanvii-widget/sanvii-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SanviiWidgetComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {}