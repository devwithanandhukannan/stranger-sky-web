import tls from 'node:tls';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads service account credentials from FIREBASE_SERVICE_ACCOUNT (env)
 * or local service-account.json
 */
export function getServiceAccount() {
  // 1. Separate individual environment variables (cleanest in Vercel!)
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'stranger-social-41bc5',
      client_email: process.env.FIREBASE_CLIENT_EMAIL.trim(),
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  // 2. Single JSON string or Base64 string
  const envVal = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (envVal) {
    try {
      if (envVal.trim().startsWith('{')) return JSON.parse(envVal);
      const decoded = Buffer.from(envVal, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {}
  }

  // 3. Local file fallback
  const candidatePaths = [
    path.resolve(process.cwd(), 'service-account.json'),
    path.resolve(process.cwd(), '../stranger-social-41bc5-firebase-adminsdk-fbsvc-6ead8f6850.json'),
    path.resolve(process.cwd(), 'stranger-social-41bc5-firebase-adminsdk-fbsvc-6ead8f6850.json'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {}
    }
  }
  return null;
}

function signJwt(payload: object, privateKeyPem: string) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encode = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(privateKeyPem, 'base64url');
  return `${unsigned}.${signature}`;
}

async function getAccessToken(sa: any) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase',
    iat: now,
    exp: now + 3600,
  };
  const jwt = signJwt(payload, sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth error: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function generatePasswordResetLink(email: string, continueUrl?: string) {
  const sa = getServiceAccount();
  if (!sa) {
    throw new Error('Firebase service account credentials missing. Please set FIREBASE_SERVICE_ACCOUNT in environment or add service-account.json.');
  }

  const token = await getAccessToken(sa);
  const target = continueUrl || 'https://stranger-sky-web.vercel.app/auth/action';
  const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email,
      returnOobLink: true,
      continueUrl: target,
      canHandleCodeInApp: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Identity Toolkit error: ${err}`);
  }

  const data = await res.json();
  return data.oobLink as string;
}

export function renderPasswordResetEmail({ resetLink, email }: { resetLink: string; email: string }) {
  const subject = 'Reset your Untold password';
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111111;
      -webkit-font-smoothing: antialiased;
    }
    table { border-spacing: 0; }
    td { padding: 0; }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #fafafa;
      padding-top: 48px;
      padding-bottom: 48px;
    }
    .main-card {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 540px;
      border: 1px solid #e5e5ea;
      border-radius: 20px;
      padding: 44px 40px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
    }
    .brand-logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #111111;
      text-decoration: none;
      display: inline-block;
      margin-bottom: 28px;
    }
    .brand-logo span { color: #0071e3; }
    .h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #111111;
      margin: 0 0 14px 0;
      line-height: 1.25;
    }
    .paragraph {
      font-size: 15px;
      line-height: 1.55;
      color: #555555;
      margin: 0 0 20px 0;
    }
    .button-table { margin: 32px 0; }
    .btn-primary {
      background-color: #111111;
      color: #ffffff !important;
      font-size: 14.5px;
      font-weight: 600;
      text-decoration: none !important;
      padding: 14px 36px;
      border-radius: 9999px;
      display: inline-block;
      letter-spacing: -0.01em;
    }
    .security-note {
      background-color: #f8f8fa;
      border: 1px solid #ededf2;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 13px;
      color: #666666;
      line-height: 1.45;
      margin-top: 24px;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 12px;
      color: #999999;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" align="center" class="main-card">
      <tr>
        <td>
          <a href="https://untold.app" class="brand-logo">untold<span>.</span></a>
          <h1 class="h1">Reset your password</h1>
          <p class="paragraph">
            Hello, we received a request to reset the password for your Untold account (<strong>${email}</strong>).
          </p>
          <p class="paragraph" style="margin-bottom: 0;">
            Click the button below to choose a new password:
          </p>

          <!-- Clean Action Button -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="button-table">
            <tr>
              <td>
                <a href="${resetLink}" target="_blank" rel="noopener noreferrer" class="btn-primary">
                  Reset Password
                </a>
              </td>
            </tr>
          </table>

          <div class="security-note">
            <strong>Security Notice:</strong> This link is single-use and will expire in 1 hour. If you did not request this, you can safely ignore this email — your account remains completely secure.
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" align="center" style="max-width: 540px; margin: 0 auto;">
      <tr>
        <td class="footer">
          Untold · Where minds meet quietly.<br>
          Ephemeral · Private · Contemplative
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;

  const text = `Reset your Untold password

Hello,

Click the button below to choose a new password for your Untold account (${email}):
${resetLink}

If you did not request this, you can safely ignore this email.

With care,
The Untold Team
`;

  return { subject, html, text };
}

export function sendSmtpEmail({
  to,
  subject,
  html,
  text,
  from = process.env.SMTP_FROM || 'Untold <workbridge.anandhu@gmail.com>',
  user = process.env.SMTP_USER || 'workbridge.anandhu@gmail.com',
  pass = (process.env.SMTP_PASS || 'jauqydwqufawlogs').replace(/\s+/g, ''),
  host = process.env.SMTP_HOST || 'smtp.gmail.com',
  port = Number(process.env.SMTP_PORT) || 465,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  user?: string;
  pass?: string;
  host?: string;
  port?: number;
}) {
  return new Promise<{ ok: boolean }>((resolve, reject) => {
    const socket = tls.connect(port, host, { rejectUnauthorized: true }, () => {});
    socket.setEncoding('utf8');

    let step = 0;
    let buffer = '';

    const sendLine = (line: string) => socket.write(line + '\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\r\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line) continue;
        const code = line.slice(0, 3);
        const isLast = line.length === 3 || line[3] === ' ';
        if (!isLast) continue;

        if (code.startsWith('4') || code.startsWith('5')) {
          socket.end();
          return reject(new Error(`SMTP error (${code}): ${line}`));
        }

        switch (step) {
          case 0:
            if (code === '220') { step = 1; sendLine('EHLO localhost'); }
            break;
          case 1:
            if (code === '250') { step = 2; sendLine('AUTH LOGIN'); }
            break;
          case 2:
            if (code === '334') { step = 3; sendLine(Buffer.from(user).toString('base64')); }
            break;
          case 3:
            if (code === '334') { step = 4; sendLine(Buffer.from(pass).toString('base64')); }
            break;
          case 4:
            if (code === '235') {
              step = 5;
              const fromEmail = from.includes('<') ? from.match(/<([^>]+)>/)?.[1] || from : from;
              sendLine(`MAIL FROM:<${fromEmail}>`);
            }
            break;
          case 5:
            if (code === '250') {
              step = 6;
              const toEmail = to.includes('<') ? to.match(/<([^>]+)>/)?.[1] || to : to;
              sendLine(`RCPT TO:<${toEmail}>`);
            }
            break;
          case 6:
            if (code === '250') { step = 7; sendLine('DATA'); }
            break;
          case 7:
            if (code === '354') {
              step = 8;
              const boundary = '----=_UntoldPart_' + Date.now().toString(36);
              const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${host}>`;
              const headers = [
                `From: ${from}`,
                `To: ${to}`,
                `Subject: ${subject}`,
                `Date: ${new Date().toUTCString()}`,
                `Message-ID: ${messageId}`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/alternative; boundary="${boundary}"`,
              ].join('\r\n');

              const body = [
                headers,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset=UTF-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                text,
                '',
                `--${boundary}`,
                'Content-Type: text/html; charset=UTF-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                html,
                '',
                `--${boundary}--`,
                '',
                '.',
              ].join('\r\n');

              sendLine(body);
            }
            break;
          case 8:
            if (code === '250') {
              step = 9;
              sendLine('QUIT');
              socket.end();
              resolve({ ok: true });
            }
            break;
        }
      }
    });

    socket.on('error', reject);
    socket.setTimeout(15000, () => {
      socket.destroy();
      reject(new Error('SMTP timeout after 15s'));
    });
  });
}

