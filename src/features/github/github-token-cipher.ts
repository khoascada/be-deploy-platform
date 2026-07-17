import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { z } from 'zod';

const ALGORITHM = 'aes-256-gcm';
const ACCESS_TOKEN_AAD = Buffer.from('github-access-token:v1', 'utf8');
const WEBHOOK_SECRET_AAD = Buffer.from('github-webhook-secret:v1', 'utf8');

const encryptedEnvelopeSchema = z.object({
  alg: z.literal('AES-256-GCM'),
  kid: z.literal(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
});

// Encrypt access tokens with AES-256-GCM; never store plaintext tokens.
export function encryptGithubToken(
  plaintext: string,
  encryptionKeyBase64: string,
): string {
  return encryptEnvelope(plaintext, encryptionKeyBase64, ACCESS_TOKEN_AAD);
}

// Encrypt webhook secrets before storing them.
export function encryptGithubWebhookSecret(
  plaintext: string,
  encryptionKeyBase64: string,
): string {
  return encryptEnvelope(plaintext, encryptionKeyBase64, WEBHOOK_SECRET_AAD);
}

// Decrypt an access-token envelope before calling GitHub.
export function decryptGithubToken(
  encryptedEnvelope: string,
  encryptionKeyBase64: string,
): string {
  const key = decodeKey(encryptionKeyBase64);
  const envelope = encryptedEnvelopeSchema.parse(
    JSON.parse(encryptedEnvelope) as unknown,
  );
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAAD(ACCESS_TOKEN_AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function decryptGithubWebhookSecret(
  encryptedEnvelope: string,
  encryptionKeyBase64: string,
): string {
  const key = decodeKey(encryptionKeyBase64);
  const envelope = encryptedEnvelopeSchema.parse(
    JSON.parse(encryptedEnvelope) as unknown,
  );
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAAD(WEBHOOK_SECRET_AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function encryptEnvelope(
  plaintext: string,
  encryptionKeyBase64: string,
  aad: Buffer,
): string {
  const key = decodeKey(encryptionKeyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return JSON.stringify({
    alg: 'AES-256-GCM',
    kid: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

// AES-256 requires the configured base64 key to decode to exactly 32 bytes.
function decodeKey(encryptionKeyBase64: string): Buffer {
  const key = Buffer.from(encryptionKeyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('GitHub token encryption key must decode to 32 bytes');
  }
  return key;
}
