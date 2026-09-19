// Products have no image field — these gradient tiles (same palette as the landing
// page's audience cards) stand in for product photography until uploads exist.
const ACCENTS = [
  'linear-gradient(160deg,#1e6b77 0%,#0e3a41 100%)',
  'linear-gradient(160deg,#e2643c 0%,#a94f2e 100%)',
  'linear-gradient(160deg,#e8a34c 0%,#c9633a 100%)',
  'linear-gradient(160deg,#14505c 0%,#0c2f38 100%)',
];

export function productAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}
