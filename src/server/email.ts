import nodemailer from "nodemailer";

// Emails through an SMTP mailbox (e.g. Hostinger: smtp.hostinger.com:465).
// Dashboard notifications are always stored; email is best-effort and only sent
// when SMTP is configured.

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (transport) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 465);
  transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  return transport;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The plain-text email in a simple branded layout: logo on top, links clickable. */
export function emailHtml(text: string) {
  const app = (process.env.APP_URL || "").replace(/\/$/, "");
  const body = esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#252525;word-break:break-all">$1</a>')
    .replace(/\n/g, "<br>");
  const logo = app
    ? `<a href="${app}" style="font:800 26px Arial,sans-serif;color:#252525;text-decoration:none;letter-spacing:2px">EVNT</a>`
    : `<div style="font:800 26px Arial,sans-serif;color:#252525;letter-spacing:2px">EVNT</div>`;
  return `<!doctype html><html><body style="margin:0;background:#f3faf6;padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:0 4px 16px">${logo}</td></tr><tr><td style="background:#ffffff;border-radius:16px;padding:24px;font:15px/1.6 Arial,Helvetica,sans-serif;color:#252525">${body}</td></tr><tr><td style="padding:16px 4px;font:12px Arial,sans-serif;color:#7a706b">EVNT · Everything for your kids. One destination.</td></tr></table></td></tr></table></body></html>`;
}

/** A designed HTML email (with a plain-text version for clients that don't show HTML). */
export async function sendRichEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
    return true;
  } catch (e) {
    console.error("[email] failed", e);
    return false;
  }
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html: emailHtml(text) });
    return true;
  } catch (e) {
    console.error("[email] failed", e);
    return false;
  }
}
