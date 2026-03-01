import { TestBed } from '@angular/core/testing';

import { Reminder } from './reminder.service';

describe('Reminder', () => {
  let service: Reminder;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Reminder);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
