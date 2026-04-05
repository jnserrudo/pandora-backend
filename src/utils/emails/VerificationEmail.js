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
  body { background-color: #0d0218; color: #ffffff; font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 0; }
  .container { max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center; }
  .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; background: linear-gradient(135deg, #8a2be2 0%, #ff1493 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .subtitle { font-size: 14px; color: #a0a0c0; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; }
  .text { font-size: 16px; color: #a3a3a3; line-height: 1.6; margin-bottom: 20px; }
  .otp-box { background: linear-gradient(135deg, rgba(138, 43, 226, 0.1) 0%, rgba(255, 20, 147, 0.1) 100%); margin: 30px 0; padding: 28px; border-radius: 16px; border: 2px solid rgba(138, 43, 226, 0.3); box-shadow: 0 8px 32px rgba(138, 43, 226, 0.2); }
  .otp-code { font-size: 42px; letter-spacing: 14px; font-weight: 900; margin: 0; background: linear-gradient(135deg, #8a2be2 0%, #ff1493 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .footer { font-size: 13px; color: #737373; margin-top: 40px; line-height: 1.5; }
  .brand-footer { font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #262626; }
</style>
</head>
<body>
  <div class="container">
    <div class="logo">Pandora</div>
    <div class="subtitle">Tu Guía de Salta</div>
    <div class="text">
      ¡Bienvenido a Pandora! 🎉<br/>
      Ingresá el siguiente código de seguridad para verificar tu cuenta:
    </div>
    <div class="otp-box">
      <p class="otp-code">${otpCode}</p>
    </div>
    <div class="footer">
      Este código expirará en 15 minutos.<br/>
      Si no solicitaste este código, podés ignorar este correo de forma segura.
    </div>
    <div class="brand-footer">
      © 2026 Pandora - Descubrí todo lo que Salta tiene para ofrecer<br/>
      Eventos • Comercios • Gastronomía • Cultura
    </div>
  </div>
</body>
</html>
`;
