/**
 * HTML pre-compilado para el correo de verificación.
 * (Alternativa hasta que react-email o mjml se instalen).
 */

export const generateVerificationEmailTemplate = (otpCode) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { background-color: #0a0a0a; color: #ffffff; font-family: system-ui, sans-serif; margin: 0; padding: 0; }
  .container { max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center; }
  .title { font-size: 28px; font-weight: bold; letter-spacing: -0.5px; margin-bottom: 20px; }
  .text { font-size: 16px; color: #a3a3a3; line-height: 1.5; }
  .otp-box { background-color: #171717; margin: 30px 0; padding: 24px; border-radius: 12px; border: 1px solid #262626; }
  .otp-code { font-size: 36px; letter-spacing: 12px; font-weight: bold; margin: 0; color: #3b82f6; }
  .footer { font-size: 13px; color: #737373; margin-top: 30px; }
</style>
</head>
<body>
  <div class="container">
    <div class="title">Antigravity</div>
    <div class="text">
      Gracias por unirte. Ingresa el siguiente código de seguridad para verificar tu cuenta:
    </div>
    <div class="otp-box">
      <p class="otp-code">${otpCode}</p>
    </div>
    <div class="footer">
      Este código expirará en 15 minutos. Si no solicitaste esto, puedes ignorar el correo.
    </div>
  </div>
</body>
</html>
`;
