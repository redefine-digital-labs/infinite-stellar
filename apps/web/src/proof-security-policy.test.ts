import { describe, expect, it } from 'vitest';
import vercel from '../../../vercel.json';

describe('production proof security policy', () => {
  it('allows WASM and isolated proof workers without opening JavaScript eval or arbitrary connections', () => {
    const header = vercel.headers.flatMap((rule) => rule.headers)
      .find((item) => item.key === 'Content-Security-Policy')!.value;
    const directives = new Map(header.split(';').map((part) => {
      const [key, ...sources] = part.trim().split(/\s+/);
      return [key!, sources];
    }));
    expect(directives.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(directives.get('worker-src')).toEqual(["'self'", 'blob:']);
    expect(directives.get('connect-src')).toEqual(["'self'", 'https://fullnode.mainnet.sui.io:443',
      'https://fullnode.testnet.sui.io:443', 'https://api.slush.app']);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('form-action')).toEqual(["'none'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
  });
});
