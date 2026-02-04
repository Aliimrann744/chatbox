export const getWelcomeEmailTemplate = (name: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Chatbox</title>
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
      margin-bottom: 20px;
    }
    .features {
      text-align: left;
      margin: 30px 0;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 10px;
    }
    .features h3 {
      color: #04003a;
      margin-bottom: 15px;
    }
    .features ul {
      list-style: none;
      padding: 0;
    }
    .features li {
      padding: 10px 0;
      color: #666666;
      border-bottom: 1px solid #eeeeee;
    }
    .features li:last-child {
      border-bottom: none;
    }
    .features li::before {
      content: "✓";
      color: #04003a;
      font-weight: bold;
      margin-right: 10px;
    }
    .cta-button {
      display: inline-block;
      background-color: #04003a;
      color: #ffffff;
      padding: 15px 40px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin-top: 20px;
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
      <h2>Welcome to Chatbox, ${name}!</h2>
      <p>Your account has been successfully verified. You're now part of the Chatbox community!</p>
      <div class="features">
        <h3>What you can do with Chatbox:</h3>
        <ul>
          <li>Send instant messages to friends and family</li>
          <li>Make voice and video calls</li>
          <li>Share photos, videos, and documents</li>
          <li>Create group chats</li>
          <li>Stay connected anywhere, anytime</li>
        </ul>
      </div>
      <p>Start chatting and connecting with people you care about!</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Chatbox. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
