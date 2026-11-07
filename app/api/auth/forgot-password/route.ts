import { NextResponse } from 'next/server';
import {
  generatePasswordResetLink,
  sendSmtpEmail,
  renderPasswordResetEmail,
} from '@/lib/server/mailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, continueUrl } = body || {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Programmatically generate the Firebase Password Reset link (Firebase DOES NOT send any email)
    const resetLink = await generatePasswordResetLink(cleanEmail, continueUrl);

    // 2. Render modern editorial HTML email with centered pill button and NO raw URLs
    const { subject, html, text } = renderPasswordResetEmail({
      resetLink,
      email: cleanEmail,
    });

    // 3. Dispatch the email via SMTP (workbridge.anandhu@gmail.com)
    await sendSmtpEmail({
      to: cleanEmail,
      subject,
      html,
      text,
    });

    return NextResponse.json({ ok: true, method: 'smtp' });
  } catch (err: any) {
    console.error('[API:forgot-password error]:', err.message);
    return NextResponse.json({ error: err.message || 'Could not send reset email.' }, { status: 500 });
  }
}

