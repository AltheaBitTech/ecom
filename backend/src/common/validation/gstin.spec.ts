import { isValidGstin, isValidPan } from './gstin';

describe('isValidGstin', () => {
  it('accepts a GSTIN whose checksum char is correctly derived', () => {
    // first14 = 27ABCDE1234F1Z, checksum computed by the same algorithm = '0'
    expect(isValidGstin('27ABCDE1234F1Z0')).toBe(true);
  });

  it('rejects a GSTIN with a mutated checksum char', () => {
    expect(isValidGstin('27ABCDE1234F1Z1')).toBe(false);
  });

  it('rejects a GSTIN that fails the format regex entirely', () => {
    expect(isValidGstin('not-a-gstin')).toBe(false);
  });
});

describe('isValidPan', () => {
  it('accepts a well-formed PAN', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
  });

  it('rejects a malformed PAN', () => {
    expect(isValidPan('ABCDE1234')).toBe(false);
  });
});
