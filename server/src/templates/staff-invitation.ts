export class StaffInvitationTemplate {
  static generate(staffName: string, clinicName: string, staffRole: string, specialization: string | null, invitationUrl: string, expiryHours: number, currentYear: number): string {
    const specializationHtml = specialization  ? `<p style="margin:0;font-size:14px;color:#6b7280;"><strong>Specialization:</strong> ${specialization}</p>`  : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Staff Invitation - ${clinicName}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">

              <!-- Body -->
              <tr>
                <td style="padding:48px 40px;">
                  <p style="font-size:16px;line-height:24px;color:#111827;margin:0 0 24px;">
                    Hello <strong>${staffName}</strong>,
                  </p>

                  <p style="font-size:15px;line-height:24px;color:#374151;margin:0 0 32px;">
                    You have been invited to join <strong>${clinicName}</strong> as a member of our staff team.
                  </p>

                  <!-- Role Details -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:6px;margin:0 0 32px;border:1px solid #e5e7eb;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Position:</strong> ${staffRole}</p>
                        ${specializationHtml}
                      </td>
                    </tr>
                  </table>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td align="center">
                        <a href="${invitationUrl}" 
                          style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;
                                font-size:15px;font-weight:600;padding:14px 40px;border-radius:6px;">
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Notice -->
                  <p style="font-size:13px;line-height:20px;color:#dc2626;margin:0 0 24px;text-align:center;">
                    This invitation expires in ${expiryHours} hours
                  </p>

                  <p style="font-size:14px;line-height:22px;color:#6b7280;margin:0;">
                    If you did not expect this invitation, please contact your administrator.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
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
