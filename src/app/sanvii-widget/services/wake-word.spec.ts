import { TestBed } from '@angular/core/testing';

import { WakeWord } from './wake-word.service';

describe('WakeWord', () => {
  let service: WakeWord;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WakeWord);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
