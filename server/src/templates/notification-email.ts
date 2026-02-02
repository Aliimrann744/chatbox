export class NotificationEmailTemplate {
  static generate(
    patientName: string,
    title: string,
    message: string,
    clinicName: string,
    currentYear: number
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          /* Rich text content styling */
          .message-content h1 { font-size: 24px; font-weight: 700; margin: 16px 0 12px; color: #1a202c; }
          .message-content h2 { font-size: 20px; font-weight: 600; margin: 14px 0 10px; color: #2d3748; }
          .message-content h3 { font-size: 18px; font-weight: 600; margin: 12px 0 8px; color: #2d3748; }
          .message-content p { margin: 0 0 12px; line-height: 1.7; }
          .message-content ul, .message-content ol { margin: 0 0 12px; padding-left: 24px; }
          .message-content li { margin-bottom: 6px; }
          .message-content strong, .message-content b { font-weight: 600; }
          .message-content em, .message-content i { font-style: italic; }
          .message-content u { text-decoration: underline; }
          .message-content a { color: #667eea; text-decoration: underline; }
          .message-content blockquote {
            border-left: 4px solid #667eea;
            margin: 12px 0;
            padding: 12px 16px;
            background-color: #f7fafc;
            border-radius: 0 8px 8px 0;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f8; line-height: 1.6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="text-align: center;">
                          <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.5px;">${clinicName}</h1>
                          <p style="color: rgba(255,255,255,0.9); font-size: 15px; margin: 0; font-weight: 500;">Notification</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: #ffffff; padding: 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td>
                          <p style="color: #1a202c; font-size: 18px; margin: 0 0 20px; font-weight: 600;">
                            Hello ${patientName},
                          </p>

                          <!-- Title -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                            <tr>
                              <td style="background-color: #f7fafc; border-radius: 12px; padding: 20px 24px; border-left: 4px solid #667eea;">
                                <h2 style="color: #2d3748; font-size: 20px; margin: 0; font-weight: 700;">
                                  ${title}
                                </h2>
                              </td>
                            </tr>
                          </table>

                          <!-- Message Content -->
                          <div class="message-content" style="color: #4a5568; font-size: 15px; line-height: 1.7;">
                            ${message}
                          </div>

                          <!-- Divider -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                            <tr>
                              <td style="border-top: 1px solid #e2e8f0;"></td>
                            </tr>
                          </table>

                          <p style="color: #718096; font-size: 14px; margin: 0; line-height: 1.6;">
                            If you have any questions, please don't hesitate to contact us. We're here to help!
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #2d3748; padding: 30px 40px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #a0aec0; font-size: 13px; margin: 0 0 10px;">
                      This notification was sent from ${clinicName}
                    </p>
                    <p style="color: #718096; font-size: 12px; margin: 0;">
                      &copy; ${currentYear} ${clinicName}. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
