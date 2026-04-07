import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import validator from 'validator';
import { generateVerificationEmailTemplate } from '../utils/emails/VerificationEmail.js';

dotenv.config();

// Configuración de las credenciales de Gmail
const userGmail = 'jnserrudo@gmail.com'; 
const passAppGmail = process.env.GMAIL_PASS;

// Configuración del transporter de Nodemailer con timeouts explícitos
// Usando puerto 587 con TLS (más compatible con entornos cloud que 465)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS en puerto 587
  requireTLS: true, // Forzar TLS
  auth: {
    user: userGmail,
    pass: passAppGmail,
  },
  // Timeouts para evitar conexiones colgadas en entornos cloud
  connectionTimeout: 15000, // 15 segundos para establecer conexión
  greetingTimeout: 10000,     // 10 segundos para recibir greeting del servidor
  socketTimeout: 15000,       // 15 segundos de inactividad
  // Pool de conexiones para reutilizar
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
  // Configuración TLS adicional
  tls: {
    rejectUnauthorized: false, // Permitir certificados self-signed si es necesario
    minVersion: 'TLSv1.2'
  }
});

// Verificar configuración al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error('⚠️  Error verificando configuración de email:', error.message);
  } else {
    console.log('✅ Servidor de email listo para enviar mensajes');
  }
});

/**
 * Función genérica para envío de correos con validación y manejo de timeouts
 */
export const sendEmail = async (to, subject, text, html) => {
    const startTime = Date.now();
    console.log(`[EMAIL] Iniciando envío de correo a: ${to}`);
    console.log(`[EMAIL] Asunto: ${subject}`);
    console.log(`[EMAIL] Timestamp: ${new Date().toISOString()}`);
    
    try {
        if (!to || !validator.isEmail(to)) {
            console.error(`[EMAIL] ❌ Email inválido: ${to}`);
            throw new Error('La dirección de correo electrónico no es válida');
        }

        console.log(`[EMAIL] ✅ Email validado: ${to}`);
        console.log(`[EMAIL] Configuración del transporter:`, {
            host: transporter.options.host,
            port: transporter.options.port,
            secure: transporter.options.secure,
            requireTLS: transporter.options.requireTLS
        });

        const mailOptions = {
            from: `"Pandora" <${userGmail}>`,
            to,
            subject,
            text,
            html,
        };

        console.log(`[EMAIL] Enviando correo...`);
        const info = await transporter.sendMail(mailOptions);
        const duration = Date.now() - startTime;
        
        console.log(`[EMAIL] ✅ Correo enviado exitosamente en ${duration}ms`);
        console.log(`[EMAIL] MessageId: ${info.messageId}`);
        console.log(`[EMAIL] Response: ${info.response}`);
        console.log(`[EMAIL] Accepted: ${info.accepted}`);
        console.log(`[EMAIL] Rejected: ${info.rejected}`);
        
        if (info.rejected.length > 0) {
            console.error(`[EMAIL] ⚠️  Algunos destinatarios fueron rechazados:`, info.rejected);
            throw new Error('Se rechazó el envío a uno o más destinatarios');
        }
        
        return { success: true, messageId: info.messageId, response: info.response };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[EMAIL] ❌ Error después de ${duration}ms`);
        console.error(`[EMAIL] Código de error: ${error.code || 'N/A'}`);
        console.error(`[EMAIL] Mensaje de error: ${error.message}`);
        console.error(`[EMAIL] Stack trace:`, error.stack);
        
        // Detectar si es un error de timeout
        const isTimeout = error.code === 'ETIMEDOUT' || 
                         error.code === 'ECONNRESET' || 
                         error.code === 'ECONNREFUSED' ||
                         error.message?.includes('timeout') ||
                         error.message?.includes('Connection timeout');
        
        if (isTimeout) {
            console.error(`[EMAIL] ⏱️  TIMEOUT detectado enviando a ${to}`);
            console.error(`[EMAIL] El servidor SMTP no respondió a tiempo`);
            throw new EmailTimeoutError(
                'No se pudo conectar al servidor de correo. Por favor, intentá reenviar el código en unos momentos.',
                { originalError: error.message, recipient: to, code: error.code }
            );
        }
        
        // Error de autenticación
        if (error.code === 'EAUTH' || error.message?.includes('Invalid login')) {
            console.error(`[EMAIL] 🔐 Error de autenticación SMTP`);
            console.error(`[EMAIL] Verificar GMAIL_PASS en variables de entorno`);
            throw new EmailAuthError(
                'Error de configuración del servidor de correo. Contactá al soporte.',
                { originalError: error.message, code: error.code }
            );
        }
        
        console.error(`[EMAIL] ❌ Error genérico de envío`);
        throw new EmailSendError(
            error.message || 'Error al enviar el correo electrónico',
            { originalError: error.message, code: error.code }
        );
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
    const adminEmail = process.env.ADMIN_EMAIL || userGmail;
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
