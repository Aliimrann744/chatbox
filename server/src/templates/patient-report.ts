export class EmailTemplates {
  static generateMedicalReportTemplate(patientName: string, clinicName: string, doctorName: string, reportUrl: string, currentYear: number): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Medical Report - ${clinicName}</title>
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
                          <p style="color: rgba(255,255,255,0.9); font-size: 15px; margin: 0; font-weight: 500;">Medical Report</p>
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
                          <p style="color: #1a202c; font-size: 18px; margin: 0 0 25px; font-weight: 600;">
                            Hello ${patientName},
                          </p>

                          <p style="color: #4a5568; font-size: 15px; margin: 0 0 25px; line-height: 1.7;">
                            Your medical report has been prepared and is ready for your review. This document contains important information about your recent consultation.
                          </p>

                          <!-- Info Card -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                            <tr>
                              <td style="background-color: #f7fafc; border-radius: 12px; padding: 24px; border-left: 4px solid #667eea;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                  <tr>
                                    <td style="padding-bottom: 12px;">
                                      <span style="color: #718096; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Prepared By</span>
                                      <p style="color: #2d3748; font-size: 16px; margin: 4px 0 0; font-weight: 600;">Dr. ${doctorName}</p>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td>
                                      <span style="color: #718096; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Date</span>
                                      <p style="color: #2d3748; font-size: 16px; margin: 4px 0 0; font-weight: 600;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>

                          <!-- CTA Button -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                            <tr>
                              <td style="text-align: center;">
                                <a href="${reportUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                  Download Report
                                </a>
                              </td>
                            </tr>
                          </table>

                          <!-- Attachment Notice -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                            <tr>
                              <td style="background-color: #ebf8ff; border-radius: 10px; padding: 16px 20px; text-align: center;">
                                <p style="color: #2b6cb0; font-size: 14px; margin: 0;">
                                  <span style="font-size: 16px; margin-right: 8px;">📎</span>
                                  <strong>Your report is also attached to this email</strong>
                                </p>
                              </td>
                            </tr>
                          </table>

                          <p style="color: #4a5568; font-size: 15px; margin: 0 0 20px; line-height: 1.7;">
                            If you have any questions about your report or need to schedule a follow-up appointment, please don't hesitate to contact us.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #2d3748; padding: 30px 40px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #a0aec0; font-size: 13px; margin: 0 0 10px;">
                      © ${currentYear} ${clinicName}. All rights reserved.
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
