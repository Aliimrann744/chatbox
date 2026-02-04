export const getOtpEmailTemplate = (name: string, otpCode: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #04003a;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .content h2 {
      color: #333333;
      margin-bottom: 20px;
    }
    .content p {
      color: #666666;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .otp-code {
      background-color: #f8f9fa;
      border: 2px dashed #04003a;
      border-radius: 10px;
      padding: 20px;
      margin: 30px 0;
    }
    .otp-code span {
      font-size: 36px;
      font-weight: bold;
      color: #04003a;
      letter-spacing: 8px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
    }
    .footer p {
      color: #999999;
      font-size: 12px;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Chatbox</h1>
    </div>
    <div class="content">
      <h2>Welcome, ${name}!</h2>
      <p>Thank you for signing up for Chatbox. To complete your registration, please enter the verification code below:</p>
      <div class="otp-code">
        <span>${otpCode}</span>
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't create an account with Chatbox, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Chatbox. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
