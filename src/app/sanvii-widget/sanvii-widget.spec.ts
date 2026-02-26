import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SanviiWidget } from './sanvii-widget.component';

describe('SanviiWidget', () => {
  let component: SanviiWidget;
  let fixture: ComponentFixture<SanviiWidget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SanviiWidget]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SanviiWidget);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
