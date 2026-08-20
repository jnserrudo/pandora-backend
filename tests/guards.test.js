import { describe, it, expect, afterEach } from '@jest/globals';
import { getDatabaseHost, isLocalDatabase } from '../src/db/databaseTarget.js';
import { verifyTurnstileToken } from '../src/utils/captcha.util.js';

describe('databaseTarget', () => {
  it('parsea host local con password URL-encoded', () => {
    const url = 'mysql://root:Hostinger1%40@127.0.0.1:3307/pandora_dev';
    expect(getDatabaseHost(url)).toBe('127.0.0.1');
    expect(isLocalDatabase(url)).toBe(true);
  });

  it('detecta el VPS como remoto', () => {
    const url = 'mysql://root:secret@195.200.0.39:3306/pandora';
    expect(getDatabaseHost(url)).toBe('195.200.0.39');
    expect(isLocalDatabase(url)).toBe(false);
  });

  it('trata localhost y ::1 como locales', () => {
    expect(isLocalDatabase('mysql://u:p@localhost:3306/db')).toBe(true);
    expect(isLocalDatabase('mysql://u:p@[::1]:3306/db')).toBe(true);
  });
});

describe('verifyTurnstileToken', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.SKIP_CAPTCHA = originalEnv.SKIP_CAPTCHA;
    process.env.TURNSTILE_SECRET_KEY = originalEnv.TURNSTILE_SECRET_KEY;
  });

  it('en test sigue bypasseando', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_CAPTCHA = undefined;
    expect(await verifyTurnstileToken('anything')).toBe(true);
  });

  it('en production sin secret rechaza el captcha', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_CAPTCHA = 'false';
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstileToken('token')).toBe(false);
  });

  it('en development sin secret permite bypass', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SKIP_CAPTCHA = 'false';
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstileToken('token')).toBe(true);
  });
});
