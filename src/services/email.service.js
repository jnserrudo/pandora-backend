import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import validator from 'validator';

dotenv.config();

// Configuración de las credenciales de Gmail
const userGmail = 'jnserrudo@gmail.com'; 
const passAppGmail = process.env.GMAIL_PASS;

// Configuración del transporter de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: userGmail,
    pass: passAppGmail,
  },
});

/**
 * Función genérica para envío de correos con validación
 */
export const sendEmail = async (to, subject, text, html) => {
    try {
        if (!to || !validator.isEmail(to)) {
            throw new Error('La dirección de correo electrónico no es válida');
        }

        const mailOptions = {
            from: `"Pandora" <${userGmail}>`,
            to,
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado:', info.messageId);
        
        if (info.rejected.length > 0) {
            throw new Error('Se rechazó el envío a uno o más destinatarios');
        }
        
        return info;
    } catch (error) {
        console.error('Error enviando correo:', error);
        throw error;
    }
};

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
                <p>&copy; 2024 Ecosistema Pandora. Todos los derechos reservados.</p>
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
                <p>&copy; 2024 Ecosistema Pandora. Todos los derechos reservados.</p>
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
                <p>&copy; 2024 Ecosistema Pandora. Todos los derechos reservados.</p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, '', html);
};
