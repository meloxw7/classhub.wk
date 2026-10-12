import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransporter();
  if (!t) throw new Error('SMTP não configurado (defina SMTP_HOST no .env).');
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'ClassHub <no-reply@classhub.local>',
    to,
    subject,
    html,
  });
}
