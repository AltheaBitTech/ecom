// GSTIN (India GST Identification Number) format + checksum validation.
// Mirrors backend/src/common/validation/gstin.ts — keep both in sync.

const GSTIN_FORMAT_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;

// PAN has no public checksum digit — the 4th character encodes holder type
// and the 5th is the first letter of the surname/name; there is no
// verifiable checksum, so PAN stays format-only.
const PAN_FORMAT_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function computeGstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codeValue = GSTIN_CHARSET.indexOf(first14[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = codeValue * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checksumIndex = (36 - (sum % 36)) % 36;
  return GSTIN_CHARSET[checksumIndex];
}

export function isValidGstin(gstin: string): boolean {
  if (!GSTIN_FORMAT_REGEX.test(gstin)) return false;

  const embeddedPan = gstin.slice(2, 12);
  if (!PAN_FORMAT_REGEX.test(embeddedPan)) return false;

  const stateCode = Number(gstin.slice(0, 2));
  if (!Number.isInteger(stateCode) || stateCode < 1 || stateCode > 38) return false;

  const first14 = gstin.slice(0, 14);
  return gstin[14] === computeGstinChecksum(first14);
}

export function isValidPan(pan: string): boolean {
  return PAN_FORMAT_REGEX.test(pan);
}
