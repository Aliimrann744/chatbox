export class OtpVerificationTemplate {
  static render(params: { name?: string; otpCode: string; expiryMinutes: number }): string {
    const { name, otpCode, expiryMinutes } = params;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Email Verification</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
          }

          .wrapper {
            width: 100%;
            padding: 40px 16px;
            background-color: #f8fafc;
          }

          .card {
            max-width: 480px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 40px 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }

          .logo-wrapper {
            text-align: center;
            margin-bottom: 24px;
          }

          .logo {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .logo-icon {
            color: #ffffff;
            font-size: 24px;
          }

          h1 {
            font-size: 24px;
            margin: 0 0 8px;
            font-weight: 700;
            color: #0f172a;
            text-align: center;
          }

          .subtitle {
            font-size: 14px;
            color: #64748b;
            text-align: center;
            margin: 0 0 32px;
          }

          p {
            font-size: 15px;
            line-height: 1.6;
            margin: 0 0 16px;
            color: #475569;
          }

          .otp-container {
            margin: 32px 0;
            text-align: center;
          }

          .otp-code {
            display: inline-block;
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            border: 2px dashed #94a3b8;
            border-radius: 12px;
            padding: 20px 40px;
            letter-spacing: 12px;
            font-size: 36px;
            font-weight: 700;
            color: #0f172a;
            font-family: 'Courier New', monospace;
          }

          .expiry-notice {
            background-color: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 8px;
            padding: 12px 16px;
            margin: 24px 0;
          }

          .expiry-notice p {
            margin: 0;
            font-size: 13px;
            color: #92400e;
          }

          .expiry-notice strong {
            color: #78350f;
          }

          .divider {
            height: 1px;
            background-color: #e2e8f0;
            margin: 24px 0;
          }

          .security-note {
            background-color: #f1f5f9;
            border-radius: 8px;
            padding: 16px;
            margin-top: 24px;
          }

          .security-note p {
            font-size: 12px;
            color: #64748b;
            margin: 0;
          }

          .footer {
            margin-top: 32px;
            text-align: center;
          }

          .footer p {
            font-size: 12px;
            color: #94a3b8;
            margin: 4px 0;
          }

          .brand {
            color: #3b82f6;
            font-weight: 600;
          }
        </style>
      </head>

      <body>
        <div class="wrapper">
          <div class="card">
            <h1>Verify Your Email</h1>
            <p class="subtitle">Complete your registration with PediaCare</p>

            <p>
              Hello${name ? ` <strong>${name}</strong>` : ''},
            </p>

            <p>
              Thank you for registering with PediaCare! To complete your account setup and ensure the security of your account, please use the verification code below:
            </p>

            <div class="otp-container">
              <div class="otp-code">${otpCode}</div>
            </div>

            <div class="expiry-notice">
              <p>
                <strong>Important:</strong> This verification code will expire in <strong>${expiryMinutes} minutes</strong>.
                Please enter it promptly to complete your registration.
              </p>
            </div>

            <div class="divider"></div>

            <div class="security-note">
              <p>
                <strong>Security Tip:</strong> Never share this code with anyone. PediaCare staff will never ask for your verification code.
                If you didn't request this code, please ignore this email or contact our support team.
              </p>
            </div>

            <div class="footer">
              <p>This is an automated message from <span class="brand">PediaCare</span></p>
              <p>Please do not reply to this email</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
