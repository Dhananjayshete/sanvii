import { TestBed } from '@angular/core/testing';

import { Briefing } from './briefing.service';

describe('Briefing', () => {
  let service: Briefing;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Briefing);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
