export const EVIDENCE_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,application/pdf';

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

const ALLOWED_EVIDENCE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export function validateEvidenceFile(file: File): string | null {
  if (file.size > MAX_EVIDENCE_BYTES) {
    return 'Evidence file must be 10MB or smaller.';
  }
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
    return 'Upload a JPEG, PNG, GIF, WebP image, or PDF receipt.';
  }
  return null;
}
