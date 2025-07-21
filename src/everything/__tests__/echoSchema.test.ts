import { describe, it, expect } from '@jest/globals';
import { EchoSchema } from '../everything.js';

describe('EchoSchema', () => {
  it('validates correct payload', () => {
    const result = EchoSchema.safeParse({ message: 'hi' });
    expect(result.success).toBe(true);
  });

  it('fails on missing message', () => {
    const result = EchoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
