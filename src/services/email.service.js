import dotenv from 'dotenv';
import validator from 'validator';
import { generateVerificationEmailTemplate } from '../utils/emails/VerificationEmail.js';

dotenv.config();

// Configuración de Brevo
const brevoApiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.FROM_EMAIL || 'noreply@pandora-app.com.ar';
const fromName = process.env.FROM_NAME || 'Pandora';

if (brevoApiKey) {
    console.log('✅ Servicio de email (Brevo) inicializado');
} else {
    console.error('⚠️  BREVO_API_KEY no configurada. El envío de emails no funcionará.');
}

/**
 * Función genérica para envío de correos usando Brevo
 */
export const sendEmail = async (to, subject, text, html) => {
    const startTime = Date.now();
    console.log(`[EMAIL] ==========================================`);
    console.log(`[EMAIL] Iniciando envío de correo a: ${to}`);
    console.log(`[EMAIL] Asunto: ${subject}`);
    console.log(`[EMAIL] Timestamp: ${new Date().toISOString()}`);
    
    try {
        if (!to || !validator.isEmail(to)) {
            console.error(`[EMAIL] ❌ Email inválido: ${to}`);
            throw new Error('La dirección de correo electrónico no es válida');
        }

        if (!brevoApiKey) {
            console.error(`[EMAIL] ❌ BREVO_API_KEY no configurada`);
            throw new EmailAuthError(
                'Servicio de email no configurado. Contactá al soporte.',
                { code: 'MISSING_API_KEY' }
            );
        }

        console.log(`[EMAIL] ✅ Email validado: ${to}`);
        console.log(`[EMAIL] Configuración:`, {
            from: `${fromName} <${fromEmail}>`,
            to: to,
            service: 'Brevo'
        });

        const emailPayload = {
            to: [{ email: to }],
            sender: { name: fromName, email: fromEmail },
            subject: subject,
            textContent: text || undefined,
            htmlContent: html || undefined
        };

        console.log(`[EMAIL] Enviando correo via Brevo API...`);
        
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify(emailPayload)
        });

        const duration = Date.now() - startTime;
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: `HTTP ${response.status}: ${response.statusText}`
            }));
            console.error(`[EMAIL] ❌ Error HTTP ${response.status}:`, errorData);
            throw new EmailSendError(
                errorData.message || `Error ${response.status} al enviar email`,
                { code: response.status, brevoError: errorData }
            );
        }
        
        const data = await response.json();
        console.log(`[EMAIL] ✅ Correo enviado exitosamente en ${duration}ms`);
        console.log(`[EMAIL] MessageId: ${data.messageId}`);
        
        return { success: true, messageId: data.messageId };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[EMAIL] ❌ Error después de ${duration}ms`);
        console.error(`[EMAIL] Mensaje de error: ${error.message}`);
        
        if (error.stack) {
            console.error(`[EMAIL] Stack:`, error.stack);
        }
        
        // Detectar errores específicos de Brevo
        const errorMessage = error.message || '';
        
        if (error.code === 'unauthorized' || error.status === 401 || errorMessage?.includes('API key')) {
            console.error(`[EMAIL] 🔐 Error de API Key`);
            throw new EmailAuthError(
                'Error de configuración del servicio de email.',
                { originalError: errorMessage, code: 'INVALID_API_KEY' }
            );
        }
        
        if (error.code === 'rate_limit' || error.status === 429 || errorMessage?.includes('rate limit')) {
            console.error(`[EMAIL] ⏱️  Rate limit alcanzado`);
            throw new EmailTimeoutError(
                'Demasiados emails enviados. Por favor, intentá más tarde.',
                { originalError: errorMessage, code: 'RATE_LIMIT' }
            );
        }
        
        // Re-lanzar errores ya categorizados
        if (error instanceof EmailTimeoutError || 
            error instanceof EmailAuthError || 
            error instanceof EmailSendError) {
            throw error;
        }
        
        console.error(`[EMAIL] ❌ Error genérico de envío`);
        throw new EmailSendError(
            error.message || 'Error al enviar el correo electrónico',
            { originalError: error.message, code: error.code || 'UNKNOWN' }
        );
    } finally {
        console.log(`[EMAIL] ==========================================`);
    }
};

// Clases de error personalizadas para manejo específico
export class EmailTimeoutError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'EmailTimeoutError';
        this.code = 'EMAIL_TIMEOUT';
        this.details = details;
    }
}

export class EmailAuthError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'EmailAuthError';
        this.code = 'EMAIL_AUTH';
        this.details = details;
    }
}

export class EmailSendError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'EmailSendError';
        this.code = 'EMAIL_SEND';
        this.details = details;
    }
}

/**
 * Notificación cuando un comercio cambia de estado (Aprobado/Rechazado)
 */
export const notifyCommerceStatusUpdate = async (email, commerceName, status, reason) => {
    const isApproved = status === 'ACTIVE';
    const subject = isApproved ? `✅ ¡Tu comercio "${commerceName}" ha sido aprobado!` : `❌ Estado de tu solicitud: ${commerceName}`;
    
    const html = isApproved 
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #8a2be2; color: #fff; padding: 20px; text-align: center;">
                <h2>¡Buenas noticias!</h2>
            </div>
            <div style="padding: 20px; color: #333;">
                <p>Tu comercio <b>${commerceName}</b> ya ha sido validado y se encuentra <b>activo</b> en la plataforma Pandora.</p>
                <p>Desde ahora, los usuarios podrán encontrar tu negocio en el mapa y ver tus productos/servicios.</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://pandora-app.com.ar/login" style="background-color: #8a2be2; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acceder a mi panel</a>
                </div>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
                <p>&copy; 2026 Pandora. Todos los derechos reservados.</p>
            </div>
        </div>`
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #ff2093; color: #fff; padding: 20px; text-align: center;">
                <h2>Actualización de solicitud</h2>
            </div>
            <div style="padding: 20px; color: #333;">
                <p>Lamentamos informarte que tu solicitud para el comercio <b>${commerceName}</b> ha sido rechazada por el equipo de moderación.</p>
                <p><b>Razón técnica:</b> ${reason || 'No especificada'}</p>
                <p>Podés corregir los datos y volver a enviar la solicitud desde tu panel de usuario.</p>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
                <p>&copy; 2026 Pandora. Todos los derechos reservados.</p>
            </div>
        </div>`;

    return await sendEmail(email, subject, '', html);
};

/**
 * Notifica al administrador sobre un nuevo envío pendiente
 */
export const notifyNewCommerceSubmission = async (commerce) => {
    const adminEmail = process.env.ADMIN_EMAIL || fromEmail;
    const subject = `🔔 Nueva solicitud pendiente: ${commerce.name}`;
    const html = `
        <h3>Nueva solicitud de alta</h3>
        <p>Un usuario ha enviado los datos de un nuevo comercio: <b>${commerce.name}</b>.</p>
        <p>Por favor, revisá el panel administrativo para validar el comercio.</p>
    `;
    return await sendEmail(adminEmail, subject, '', html);
};

/**
 * Notificación para actualizaciones de solicitudes genéricas (Submissions)
 */
export const notifySubmissionUpdate = async (email, userName, type, status, adminResponse) => {
    const subject = `📢 Actualización de tu solicitud: ${type}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #007BFF; color: #fff; padding: 20px; text-align: center;">
                <h2>Tu solicitud ha sido actualizada</h2>
            </div>
            <div style="padding: 20px; color: #333;">
                <p>Hola <b>${userName || 'Usuario'}</b>,</p>
                <p>Tu solicitud de tipo <b>${type}</b> ha pasado al estado: <b>${status}</b>.</p>
                ${adminResponse ? `
                <div style="background-color: #f1f1f1; padding: 15px; border-left: 4px solid #007BFF; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold; color: #555;">Respuesta del administrador:</p>
                    <p style="margin: 5px 0 0 0;">${adminResponse}</p>
                </div>` : ''}
                <p>Podés ver más detalles ingresando a tu panel de usuario.</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://pandora-app.com.ar/dashboard" style="background-color: #007BFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver mi solicitud</a>
                </div>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
                <p>&copy; 2026 Pandora. Todos los derechos reservados.</p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, '', html);
};

export const sendVerificationOTP = async (email, otpCode) => {
    const subject = "Pandora - Código de Verificación de Cuenta";
    const html = generateVerificationEmailTemplate(otpCode);
    return await sendEmail(email, subject, '', html);
};
