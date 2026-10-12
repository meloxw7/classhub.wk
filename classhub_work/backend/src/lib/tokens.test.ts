import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { generateToken, hashToken } from './tokens';

describe('tokens', () => {
  it('gera tokens únicos em base64url', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(30);
  });

  it('hashToken produz sha256 hex determinístico', () => {
    const t = generateToken();
    const expected = createHash('sha256').update(t).digest('hex');
    expect(hashToken(t)).toBe(expected);
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
    expect(hashToken(t)).toHaveLength(64);
  });
});
