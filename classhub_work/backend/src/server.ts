import http from 'http';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import app from './app';
import { pool } from './lib/db';
import { notifyUsers } from './lib/notify';
import { getJwtSecret } from './lib/env';
async function eventReminders() {
  try {
    const r = await pool.query(
      "SELECT e.*,s.name subject_name FROM events e LEFT JOIN subjects s ON s.id=e.subject_id WHERE e.reminder_sent_at IS NULL AND e.event_date>NOW() AND e.event_date<=NOW()+INTERVAL '24 hours'"
    );
    if (!r.rows.length) return;
    let allUsers: string[] | null = null;
    for (const e of r.rows) {
      let ids: string[];
      if (e.visibility === 'ALL') {
        if (!allUsers) {
          const users = await pool.query('SELECT id FROM users');
          allUsers = users.rows.map((x) => x.id);
        }
        ids = allUsers;
      } else if (e.visibility === 'SELECTED') {
        const t = await pool.query('SELECT user_id FROM event_targets WHERE event_id=$1', [e.id]);
        ids = t.rows.map((x) => x.user_id);
      } else {
        ids = e.author_id ? [e.author_id] : [];
      }
      const when = new Date(e.event_date).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      });
      await notifyUsers(
        ids,
        'Amanhã: ' + e.title,
        `${e.title} está marcado para ${when}${e.subject_name ? ' — ' + e.subject_name : ''}.`,
        'EVENT'
      );
      await pool.query('UPDATE events SET reminder_sent_at=NOW() WHERE id=$1', [e.id]);
    }
    console.log(`Lembretes de evento enviados: ${r.rows.length}`);
  } catch (error) {
    console.error('Erro nos lembretes de evento:', error);
  }
}
const port = Number(process.env.PORT) || 4000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
type ChatEntry = { ws: WebSocket; userId: string; name: string; avatar: string | null };
const chatRooms = new Map<string, Set<ChatEntry>>();
function chatLeave(socket: WebSocket, room: string) {
  const set = chatRooms.get(room);
  if (!set) return;
  for (const entry of [...set]) if (entry.ws === socket) set.delete(entry);
  if (!set.size) chatRooms.delete(room);
}
function chatBroadcast(room: string, data: string, exclude?: WebSocket) {
  const set = chatRooms.get(room);
  if (!set) return;
  for (const entry of set) {
    if (entry.ws === exclude) continue;
    if (entry.ws.readyState === WebSocket.OPEN) entry.ws.send(data);
  }
}
function chatPresence(room: string) {
  const set = chatRooms.get(room);
  if (!set) return;
  const map = new Map<string, { id: string; name: string; avatar: string | null }>();
  for (const entry of set)
    map.set(entry.userId, { id: entry.userId, name: entry.name, avatar: entry.avatar });
  const data = JSON.stringify({ type: 'presence', users: [...map.values()] });
  for (const entry of set) if (entry.ws.readyState === WebSocket.OPEN) entry.ws.send(data);
}
wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  let user: { id: string; name: string } | null = null;
  let joinedRoom = '';
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const payload = jwt.verify(url.searchParams.get('token') || '', getJwtSecret()) as any;
    user = { id: payload.id, name: payload.name };
  } catch {
    ws.close(4001, 'Não autenticado');
    return;
  }
  ws.on('message', async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg?.type === 'join' && user) {
      const room = String(msg.subjectId || '');
      if (!room) return;
      if (joinedRoom) {
        chatLeave(ws, joinedRoom);
        chatPresence(joinedRoom);
      }
      joinedRoom = 'subject:' + room;
      if (!chatRooms.has(joinedRoom)) chatRooms.set(joinedRoom, new Set());
      let avatar: string | null = null;
      try {
        const a = await pool.query('SELECT avatar_path FROM users WHERE id=$1', [user.id]);
        avatar = a.rows[0]?.avatar_path || null;
      } catch {}
      chatRooms.get(joinedRoom)!.add({ ws, userId: user.id, name: user.name, avatar });
      ws.send(JSON.stringify({ type: 'joined', subjectId: room }));
      chatPresence(joinedRoom);
      return;
    }
    if (msg?.type === 'message' && user && joinedRoom) {
      const content = String(msg.content || '')
        .trim()
        .slice(0, 1000);
      if (!content) return;
      const room = joinedRoom;
      const self = [...(chatRooms.get(room) || [])].find((e) => e.ws === ws);
      try {
        const r = await pool.query(
          'INSERT INTO chat_messages(subject_id,user_id,content) VALUES($1,$2,$3) RETURNING id,created_at',
          [room.replace('subject:', ''), user.id, content]
        );
        chatBroadcast(
          room,
          JSON.stringify({
            type: 'message',
            id: r.rows[0].id,
            subjectId: room.replace('subject:', ''),
            content,
            userName: user.name,
            userId: user.id,
            user_name: user.name,
            user_id: user.id,
            avatar: self?.avatar || null,
            avatar_path: self?.avatar || null,
            createdAt: r.rows[0].created_at,
            created_at: r.rows[0].created_at,
          })
        );
      } catch (error) {
        console.error('Erro no chat:', error);
      }
      return;
    }
    if (msg?.type === 'typing' && user && joinedRoom) {
      chatBroadcast(
        joinedRoom,
        JSON.stringify({
          type: 'typing',
          userId: user.id,
          userName: user.name,
          typing: !!msg.typing,
        }),
        ws
      );
      return;
    }
  });
  ws.on('close', () => {
    if (joinedRoom) {
      const room = joinedRoom;
      chatLeave(ws, room);
      chatPresence(room);
    }
  });
  ws.on('error', () => {});
});
server.listen(port, () => {
  console.log(`ClassHub API em http://localhost:${port}`);
  eventReminders();
  setInterval(eventReminders, 30 * 60 * 1000);
});
