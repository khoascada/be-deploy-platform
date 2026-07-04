import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { z } from 'zod';

const ALGORITHM = 'aes-256-gcm';
const ENV_VAR_AAD = Buffer.from('project-env-var:v1', 'utf8');

const encryptedEnvelopeSchema = z.object({
  alg: z.literal('AES-256-GCM'),
  kid: z.literal(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
});

export function encryptEnvVarValue(
  plaintext: string,
  encryptionKeyBase64: string,
): string {
  const key = decodeKey(encryptionKeyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(ENV_VAR_AAD);

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

export function decryptEnvVarValue(
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
  decipher.setAAD(ENV_VAR_AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function decodeKey(encryptionKeyBase64: string): Buffer {
  const key = Buffer.from(encryptionKeyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('Env var encryption key must decode to 32 bytes');
  }

  return key;
}
