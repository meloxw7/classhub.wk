import { api } from './api';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerPWA() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.PROD) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch {}
  } else {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export async function enableNotifications() {
  if (!('Notification' in window)) throw new Error('Seu navegador não suporta notificações.');
  const p = await Notification.requestPermission();
  if (p !== 'granted') throw new Error('Permissão de notificações não concedida.');
  if (!('serviceWorker' in navigator)) return true;
  const registration = await navigator.serviceWorker.ready;
  const { data } = await api.get('/notifications/vapid-public');
  const publicKey: string = data?.publicKey || '';
  if (!publicKey) return true;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  if (!existing) {
    await api.post('/notifications/subscribe', {
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
    });
  }
  return true;
}
