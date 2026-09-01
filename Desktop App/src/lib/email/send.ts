import nodemailer from 'nodemailer'

// Server-only — only call from inside a server function handler. Gmail
// SMTP is an interim sender until a real email domain is set up; swap for
// Resend/Postmark's API later (see supabase/functions/heartbeat-cron/README.md,
// which uses the same Gmail account from the Deno side for the escalation cron).
let transport: ReturnType<typeof nodemailer.createTransport> | undefined

function getTransport() {
  if (!transport) {
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_APP_PASSWORD
    if (!user || !pass) {
      throw new Error('Missing SMTP_USER/SMTP_APP_PASSWORD. Set them in .env (server-only).')
    }
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    })
  }
  return transport
}

export async function sendEmail(to: string, subject: string, text: string) {
  const user = process.env.SMTP_USER!
  await getTransport().sendMail({ from: user, to, subject, text })
}
