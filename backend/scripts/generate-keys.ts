/**
 * Generates an RS256 keypair for JWT signing and writes PEM files to ./keys.
 *
 *   npm run keys:generate
 *
 * ecom holds the PRIVATE key and signs its own access tokens; the PUBLIC key is
 * served at /.well-known/jwks.json so the frontend and any external verifier can
 * validate tokens locally. In production, load keys from a secrets manager
 * (JWT_PRIVATE_KEY / JWT_PUBLIC_KEY), not the filesystem.
 */
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function main(): void {
  const keysDir = join(process.cwd(), 'keys');
  mkdirSync(keysDir, { recursive: true });

  const privatePath = join(keysDir, 'jwt-private.pem');
  const publicPath = join(keysDir, 'jwt-public.pem');

  if (existsSync(privatePath) || existsSync(publicPath)) {
    console.error('Refusing to overwrite existing keys in ./keys. Delete them first.');
    process.exit(1);
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  writeFileSync(privatePath, privateKey, { mode: 0o600 });
  writeFileSync(publicPath, publicKey, { mode: 0o644 });

  // eslint-disable-next-line no-console
  console.warn(`Wrote ${privatePath} and ${publicPath}. Keep the private key secret.`);
}

main();
