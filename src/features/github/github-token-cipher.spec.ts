import {
  decryptGithubToken,
  encryptGithubToken,
  encryptGithubWebhookSecret,
} from './github-token-cipher';

describe('GitHub token cipher', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');

  it('encrypts without retaining plaintext and decrypts the token', () => {
    const token = 'gho_sensitive_access_token';

    const encrypted = encryptGithubToken(token, encryptionKey);

    expect(encrypted).not.toContain(token);
    expect(JSON.parse(encrypted)).toMatchObject({
      alg: 'AES-256-GCM',
      kid: 1,
    });
    expect(decryptGithubToken(encrypted, encryptionKey)).toBe(token);
  });

  it('encrypts webhook secrets without retaining plaintext', () => {
    const secret = 'webhook_secret_value';

    const encrypted = encryptGithubWebhookSecret(secret, encryptionKey);

    expect(encrypted).not.toContain(secret);
    expect(JSON.parse(encrypted)).toMatchObject({
      alg: 'AES-256-GCM',
      kid: 1,
    });
  });

  it('rejects an encryption key that is not 32 bytes', () => {
    expect(() => encryptGithubToken('token', 'invalid')).toThrow(
      'GitHub token encryption key must decode to 32 bytes',
    );
  });
});
