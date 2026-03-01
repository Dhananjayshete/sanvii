import { TestBed } from '@angular/core/testing';

import { Stats } from './stats.service';

describe('Stats', () => {
  let service: Stats;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Stats);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
