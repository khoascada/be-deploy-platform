import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { z } from 'zod';

const ALGORITHM = 'aes-256-gcm';
const AAD = Buffer.from('github-access-token:v1', 'utf8');

const encryptedEnvelopeSchema = z.object({
  alg: z.literal('AES-256-GCM'),
  kid: z.literal(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
});

// Mã hóa access token bằng AES-256-GCM để không lưu token dạng plaintext trong database.
export function encryptGithubToken(
  plaintext: string,
  encryptionKeyBase64: string,
): string {
  const key = decodeKey(encryptionKeyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);

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

// Giải mã encrypted envelope khi backend cần dùng access token để gọi GitHub API.
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
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

// Decode key từ base64 và bắt buộc key có đúng 32 byte theo yêu cầu của AES-256.
function decodeKey(encryptionKeyBase64: string): Buffer {
  const key = Buffer.from(encryptionKeyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('GitHub token encryption key must decode to 32 bytes');
  }
  return key;
}
