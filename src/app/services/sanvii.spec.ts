import { TestBed } from '@angular/core/testing';

import { Sanvii } from './sanvii';

describe('Sanvii', () => {
  let service: Sanvii;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sanvii);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
