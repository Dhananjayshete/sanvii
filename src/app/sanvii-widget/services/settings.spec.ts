import { TestBed } from '@angular/core/testing';

import { Settings } from './settings.service';

describe('Settings', () => {
  let service: Settings;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Settings);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
