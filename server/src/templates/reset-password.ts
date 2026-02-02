export class ResetPasswordTemplate {
  static render(params: { name?: string; resetUrl: string }): string {
    const { name, resetUrl } = params;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Password Reset</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            color: #222222;
          }

          .wrapper {
            width: 100%;
            padding: 40px 16px;
          }

          .card {
            max-width: 560px;
            margin: 0 auto;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 32px;
          }

          h1 {
            font-size: 20px;
            margin: 0 0 16px;
            font-weight: 600;
            color: #111827;
          }

          p {
            font-size: 14px;
            line-height: 1.6;
            margin: 0 0 16px;
            color: #374151;
          }

          .button-wrapper {
            margin: 24px 0;
            text-align: center;
          }

          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #111827;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
          }

          .link {
            word-break: break-all;
            font-size: 13px;
            color: #1f2937;
          }

          .divider {
            height: 1px;
            background-color: #e5e7eb;
            margin: 24px 0;
          }

          .footer {
            font-size: 12px;
            color: #6b7280;
            margin-top: 24px;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="wrapper">
          <div class="card">
            <h1>Password reset request</h1>

            <p>
              Hello${name ? ` ${name}` : ''},
            </p>

            <p>
              We received a request to reset the password associated with your account.
              To proceed, please click the button below.
            </p>

            <div class="button-wrapper">
              <a href="${resetUrl}" class="button">Reset password</a>
            </div>

            <p>
              This link will expire in <strong>1 hour</strong> for security reasons.
            </p>
            <div class="divider"></div>
            <p>
              If you did not request a password reset, no further action is required.
              Your account remains secure.
            </p>
            <div class="footer">
              <p>This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
