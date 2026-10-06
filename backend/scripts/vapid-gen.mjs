import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('Cole as chaves abaixo no backend/.env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\nVAPID_SUBJECT=mailto:seu-email@exemplo.com');
