import nodemailer from 'nodemailer';

export async function envoyerEmail(opts: { to: string; subject: string; text: string }): Promise<{ envoye: boolean; raison?: string }> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return { envoye: false, raison: 'SMTP_HOST non configuré.' };
  const to = opts.to.trim();
  if (!to) return { envoye: false, raison: 'Adresse e-mail destinataire manquante.' };
  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'manupro@usine.local',
      to,
      subject: opts.subject,
      text: opts.text,
    });
    return { envoye: true };
  } catch (e) {
    return { envoye: false, raison: e instanceof Error ? e.message : 'Envoi e-mail impossible.' };
  }
}
