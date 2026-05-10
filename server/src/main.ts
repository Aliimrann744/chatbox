import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const server = app.getHttpServer();
  server.setTimeout(60000);

  // Increase JSON/URL-encoded body size limit
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  // Serve uploaded files as static assets (before global prefix)
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Account deletion request page (Google Play Store requirement)
  app.use('/delete-account', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Delete Your Whatchat Account</title>
  <meta name="description" content="Steps to request deletion of your Whatchat account and associated data." />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.65;
      color: #1f2937;
      background: #f3f4f6;
      margin: 0;
      padding: 24px 16px;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px 36px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    }
    header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    h1 {
      color: #111827;
      font-size: 28px;
      margin: 0 0 8px 0;
    }
    h2 {
      color: #111827;
      font-size: 20px;
      margin-top: 32px;
      margin-bottom: 12px;
    }
    .app-info {
      color: #6b7280;
      font-size: 14px;
    }
    p { margin: 10px 0; }
    ol, ul { padding-left: 22px; }
    li { margin-bottom: 8px; }
    .highlight {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 18px 0;
    }
    .contact-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 18px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      padding: 12px 14px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 13px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Delete Your Whatchat Account</h1>
      <p class="app-info">
        <strong>App:</strong> Whatchat &middot;
        <strong>Package:</strong> com.chatbox.app
      </p>
    </header>

    <p>
      We respect your right to control your personal information. This page explains
      how to request the deletion of your <strong>Whatchat</strong> account and the
      data associated with it.
    </p>

    <h2>How to Request Account Deletion</h2>
    <p>You can request deletion of your account using either of the following methods:</p>

    <h3>Option 1 &mdash; Delete From the App</h3>
    <ol>
      <li>Open the <strong>Whatchat</strong> app on your device.</li>
      <li>Tap your profile picture or the <strong>Settings</strong> icon.</li>
      <li>Go to <strong>Account</strong> &rarr; <strong>Privacy</strong>.</li>
      <li>Select <strong>Delete Account</strong>.</li>
      <li>Confirm your identity by entering your password or verification code.</li>
      <li>Tap <strong>Delete My Account</strong> to permanently submit the request.</li>
    </ol>

    <h3>Option 2 &mdash; Request by Email</h3>
    <ol>
      <li>
        Send an email from your registered email address to
        <a href="mailto:support@whatsappbizz.com">support@whatsappbizz.com</a>.
      </li>
      <li>Use the subject line: <strong>"Account Deletion Request"</strong>.</li>
      <li>
        Include the following details so we can verify your identity:
        <ul>
          <li>Your registered phone number or email</li>
          <li>Your full name as shown on the account</li>
          <li>The reason for the request (optional)</li>
        </ul>
      </li>
      <li>
        Our team will verify your request and process the deletion within
        <strong>7 business days</strong>. You will receive a confirmation email
        once your account has been deleted.
      </li>
    </ol>

    <div class="highlight">
      <strong>Important:</strong> Once your account is deleted, this action cannot be
      undone. You will lose access to all your messages, contacts, groups, calls history,
      status updates, and other content associated with your account.
    </div>

    <h2>What Data Is Deleted</h2>
    <p>
      Upon a verified deletion request, the following data will be
      <strong>permanently removed</strong> from our active systems:
    </p>
    <ul>
      <li>Your account profile (name, profile picture, bio, status)</li>
      <li>Your phone number and email associated with the account</li>
      <li>All chat messages, media, and shared files</li>
      <li>Your contacts and contact list</li>
      <li>Your group memberships and group-related data created by you</li>
      <li>Call history (audio and video calls)</li>
      <li>Status updates and stories you have posted</li>
      <li>Notification tokens and device identifiers</li>
      <li>Settings, preferences, and two-factor authentication data</li>
    </ul>

    <h2>What Data May Be Retained</h2>
    <p>
      For legal, security, and fraud-prevention purposes, certain limited information
      may be retained for a period after deletion:
    </p>
    <table>
      <thead>
        <tr>
          <th>Data Type</th>
          <th>Retention Period</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Anonymized usage logs</td>
          <td>Up to 90 days</td>
          <td>Service diagnostics and abuse prevention</td>
        </tr>
        <tr>
          <td>Transaction or billing records (if any)</td>
          <td>Up to 7 years</td>
          <td>Legal, tax, and accounting compliance</td>
        </tr>
        <tr>
          <td>Records related to legal investigations or disputes</td>
          <td>As required by law</td>
          <td>Compliance with applicable legal obligations</td>
        </tr>
        <tr>
          <td>Backup copies</td>
          <td>Up to 30 days</td>
          <td>Standard backup rotation; permanently purged thereafter</td>
        </tr>
        <tr>
          <td>Messages sent to other users</td>
          <td>Retained on recipient devices</td>
          <td>Messages already delivered to other users remain in their accounts</td>
        </tr>
      </tbody>
    </table>

    <p>
      All retained data is stored securely and is only accessed when strictly
      necessary for the purposes listed above. Once the retention period expires,
      the data is permanently deleted.
    </p>

    <h2>Need Help?</h2>
    <div class="contact-box">
      <p style="margin: 0;">
        If you have any questions about account deletion or data privacy, contact us at
        <a href="mailto:support@whatsappbizz.com">support@whatsappbizz.com</a>. We aim to respond
        to all inquiries within 2 business days.
      </p>
    </div>

    <footer>
      &copy; ${new Date().getFullYear()} Whatchat. All rights reserved.
    </footer>
  </div>
</body>
</html>`);
  });

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix — exclude admin-panel so its routes resolve at root paths
  // (/admin-panel, /admin-panel/dashboard, /admin-panel/api/...).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'admin-panel', method: RequestMethod.ALL },
      { path: 'admin-panel/(.*)', method: RequestMethod.ALL },
    ],
  });
  const port = process.env.PORT;
  await app.listen(port);
  console.log(`Server is running on http://localhost:${port}`);
}

bootstrap();