import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from './app';
import { pool } from './lib/db';
import { hashToken } from './lib/tokens';
import { sendPushToUsers, pushConfigured } from './lib/push';
import webpush from 'web-push';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => ({})),
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('web push (web-push mockado, banco real)', () => {
  let alunoId = '';
  const createdHashes: string[] = [];
  const ORIGINAL_VAPID_PUB = process.env.VAPID_PUBLIC_KEY;
  const ORIGINAL_VAPID_PRIV = process.env.VAPID_PRIVATE_KEY;
  const sendNotification = vi.mocked(webpush.sendNotification);
  const setVapidDetails = vi.mocked(webpush.setVapidDetails);

  async function login() {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aluno@classhub.local', password: '123456' });
    createdHashes.push(hashToken(res.body.refreshToken));
    return res.body;
  }

  beforeAll(async () => {
    const aluno = await login();
    alunoId = aluno.user.id;
  });

  afterAll(async () => {
    if (alunoId) await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1', [alunoId]);
    if (createdHashes.length)
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ANY($1)', [createdHashes]);
    if (ORIGINAL_VAPID_PUB === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = ORIGINAL_VAPID_PUB;
    if (ORIGINAL_VAPID_PRIV === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = ORIGINAL_VAPID_PRIV;
    await pool.end();
  });

  it('pushConfigured reflete as variáveis VAPID', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushConfigured()).toBe(false);
    process.env.VAPID_PUBLIC_KEY = 'chave-publica-teste';
    process.env.VAPID_PRIVATE_KEY = 'chave-privada-teste';
    expect(pushConfigured()).toBe(true);
  });

  it('sem VAPID configurado, não tenta enviar nada', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    sendNotification.mockClear();
    setVapidDetails.mockClear();
    await sendPushToUsers([alunoId], { title: 'Teste', body: 'Sem push' });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(setVapidDetails).not.toHaveBeenCalled();
    // restaura VAPID para os próximos testes (o flag interno "configured" é por processo)
    process.env.VAPID_PUBLIC_KEY = 'chave-publica-teste';
    process.env.VAPID_PRIVATE_KEY = 'chave-privada-teste';
  });

  it('envia payload para cada subscription e remove endpoints mortos (410)', async () => {
    const alive = {
      endpoint: 'https://push.test/alive',
      keys: { p256dh: 'k', auth: 'a' },
    };
    const dead = {
      endpoint: 'https://push.test/dead',
      keys: { p256dh: 'k', auth: 'a' },
    };
    await pool.query(
      'INSERT INTO push_subscriptions(user_id,endpoint,subscription) VALUES($1,$2,$3)',
      [alunoId, alive.endpoint, alive]
    );
    await pool.query(
      'INSERT INTO push_subscriptions(user_id,endpoint,subscription) VALUES($1,$2,$3)',
      [alunoId, dead.endpoint, dead]
    );

    sendNotification.mockImplementation(async (sub: any) => {
      if (String(sub.endpoint).includes('dead')) {
        const error: any = new Error('Subscription gone');
        error.statusCode = 410;
        throw error;
      }
      return {} as any;
    });

    const payload = { title: 'ClassHub', body: 'Push de teste', type: 'EVENT' };
    await sendPushToUsers([alunoId], payload);

    expect(setVapidDetails).toHaveBeenCalledWith(
      'mailto:no-reply@classhub.local',
      'chave-publica-teste',
      'chave-privada-teste'
    );
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const sentPayloads = sendNotification.mock.calls.map((c) => JSON.parse(String(c[1])));
    expect(sentPayloads.every((p) => p.title === 'ClassHub' && p.type === 'EVENT')).toBe(true);

    const remaining = await pool.query(
      'SELECT endpoint FROM push_subscriptions WHERE user_id=$1',
      [alunoId]
    );
    expect(remaining.rows.map((r: any) => r.endpoint)).toEqual([alive.endpoint]);
  });

  it('lista vazia de usuários não faz nada', async () => {
    sendNotification.mockClear();
    await sendPushToUsers([], { title: 'x', body: 'y' });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
