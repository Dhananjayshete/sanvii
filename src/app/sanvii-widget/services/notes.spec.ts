import { TestBed } from '@angular/core/testing';

import { Notes } from './notes.service';

describe('Notes', () => {
  let service: Notes;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Notes);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
