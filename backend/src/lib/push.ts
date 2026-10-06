import webpush from 'web-push';
import { pool } from './db';

let configured = false;

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureConfig() {
  if (configured) return;
  if (pushConfigured()) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:no-reply@classhub.local',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  }
  configured = true;
}

export type PushPayload = { title: string; body: string; type?: string };

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!userIds.length || !pushConfigured()) return;
  ensureConfig();
  const r = await pool.query(
    'SELECT id, endpoint, subscription FROM push_subscriptions WHERE user_id = ANY($1::uuid[])',
    [userIds]
  );
  const dead: string[] = [];
  await Promise.all(
    r.rows.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload));
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) dead.push(row.id);
      }
    })
  );
  if (dead.length)
    await pool.query('DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])', [dead]);
}
