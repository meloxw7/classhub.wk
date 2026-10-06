import { pool } from './db';
import { sendPushToUsers } from './push';

export async function notifyUsers(
  userIds: string[],
  title: string,
  body: string,
  type = 'INFO'
): Promise<void> {
  if (!userIds.length) return;
  await pool.query(
    'INSERT INTO notifications(user_id,title,body,type) SELECT unnest($1::uuid[]),$2,$3,$4',
    [userIds, title, body, type]
  );
  sendPushToUsers(userIds, { title, body, type }).catch((error) =>
    console.error('Erro ao enviar push:', error)
  );
}

export async function notifyAllStudents(
  title: string,
  body: string,
  type = 'INFO'
): Promise<void> {
  const r = await pool.query("SELECT id FROM users WHERE role='ALUNO'");
  await notifyUsers(
    r.rows.map((x) => x.id),
    title,
    body,
    type
  );
}
