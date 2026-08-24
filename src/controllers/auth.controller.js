import * as authModel from '../models/auth.model.js';
import * as auditService from '../services/audit.service.js';
import { sendVerificationOTP, EmailTimeoutError } from '../services/email.service.js';
import prisma from '../db/prismaClient.js';

export const registerUser = async (req, res) => {
    const requestStart = Date.now();
    console.log(`[AUTH] ==========================================`);
    console.log(`[AUTH] Iniciando registro de usuario`);
    console.log(`[AUTH] Timestamp: ${new Date().toISOString()}`);
    
    try {
        const { email, username, password, name, captchaToken } = req.body;

        if (!email || !username || !password || !name) {
            console.log(`[AUTH] ❌ Datos incompletos en registro`);
            return res.status(400).json({ message: 'Se requieren email, nombre de usuario, nombre y contraseña.' });
        }

        const { user: newUser, otpCode } = await authModel.registerUserService(req.body);
        console.log(`[AUTH] ✅ Usuario creado en DB`);
        
        // Despachar el correo electrónico con otpCode
        let emailSent = false;
        let emailError = null;
        
        console.log(`[AUTH] Iniciando envío de email de verificación...`);
        try {
            await sendVerificationOTP(newUser.email, otpCode);
            emailSent = true;
            console.log(`[AUTH] ✅ Email enviado exitosamente`);
        } catch (err) {
            emailError = err;
            console.error(`[AUTH] ❌ Error enviando email: ${err.message}`);
            
            if (err instanceof EmailTimeoutError) {
                console.log(`[AUTH] ⏱️  Timeout detectado - se habilitará reenvío`);
            }
        }
        
        const duration = Date.now() - requestStart;
        console.log(`[AUTH] Proceso completado en ${duration}ms`);
        console.log(`[AUTH] Email enviado: ${emailSent}`);
        console.log(`[AUTH] CanResendOTP: ${!emailSent}`);

        const exposeDebugOtp =
            !emailSent &&
            process.env.NODE_ENV !== 'production' &&
            process.env.ALLOW_DEBUG_OTP === 'true';
        
        // Responder al cliente
        const response = { 
            message: emailSent
                ? 'Usuario registrado exitosamente. Revisá tu email.'
                : 'Usuario registrado exitosamente. No pudimos enviar el email de verificación. Usá "Reenviar código" o contactá a un admin.',
            user: newUser,
            emailSent: emailSent,
            canResendOTP: !emailSent,
            debugOTP: exposeDebugOtp ? otpCode : undefined,
            emailError: emailError && !emailSent ? {
                code: emailError.code || 'EMAIL_ERROR',
                message: emailError.message
            } : undefined
        };
        
        console.log(`[AUTH] Enviando respuesta al cliente`);
        res.status(201).json(response);

        // Auditoría
        await auditService.createLog({
            userId: newUser.id,
            action: 'CREATE',
            resourceType: 'USER',
            resourceId: newUser.id,
            newData: newUser,
            req
        });
        
        console.log(`[AUTH] ==========================================`);
    } catch (error) {
        const duration = Date.now() - requestStart;
        console.error(`[AUTH] ❌ Error en registro después de ${duration}ms:`, error.message);
        console.error(`[AUTH] Stack:`, error.stack);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error interno del servidor.',
            requireCaptcha: error.requireCaptcha,
            isVerified: error.isVerified
        });
    }
};

/**
 * Reenvía el código OTP a un usuario no verificado
 */
export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'El email es requerido.' });
        }

        // Generar nuevo OTP
        const { user, otpCode } = await authModel.resendOTPService(email);
        console.log(`[AUTH] 🔄 Reenviando OTP`);

        // Intentar enviar el email
        let emailSent = false;
        let emailError = null;

        try {
            await sendVerificationOTP(user.email, otpCode);
            emailSent = true;
            console.log('✅ OTP reenviado exitosamente');
        } catch (err) {
            emailError = err;
            console.error("❌ Error reenviando email OTP:", err.message);
        }

        // Responder según el resultado
        if (emailSent) {
            res.status(200).json({
                message: 'Código de verificación reenviado exitosamente. Revisá tu email.',
                emailSent: true
            });
        } else {
            res.status(200).json({
                message: 'No pudimos enviar el email. Por favor, intentá nuevamente en unos momentos.',
                emailSent: false,
                emailError: emailError ? {
                    code: emailError.code || 'EMAIL_ERROR',
                    message: emailError.message
                } : undefined
            });
        }

        // Auditoría
        await auditService.createLog({
            userId: user.id,
            action: 'RESEND_OTP',
            resourceType: 'USER',
            resourceId: user.id,
            newData: { emailSent, hasError: !!emailError },
            req
        });
    } catch (error) {
        console.error('[AUTH] Error:', error.message);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error al reenviar el código.',
            code: error.code
        });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { identifier, password, captchaToken } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ message: 'Se requiere el identificador (email o nombre de usuario) y la contraseña.' });
        }
        const tokens = await authModel.loginUserService(identifier, password, captchaToken);
        res.status(200).json({ message: 'Inicio de sesión exitoso.', ...tokens });

        // Auditoría
        const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
        await auditService.createLog({
            userId: user?.id,
            action: 'LOGIN',
            resourceType: 'USER',
            resourceId: user?.id,
            req
        });
    } catch (error) {
        console.error('[AUTH] Error:', error.message);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error interno del servidor.',
            requireCaptcha: error.requireCaptcha,
            isVerified: error.isVerified
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Se requieren el email y el código OTP.' });
        }
        const result = await authModel.verifyOTPService(email, otp);
        res.status(200).json({ message: 'Cuenta verificada con éxito.', ...result });
    } catch (error) {
        console.error('[AUTH] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await authModel.refreshAccessTokenService(refreshToken);
        res.status(200).json(result);
    } catch (error) {
        console.error('[AUTH] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

export const logoutUser = async (req, res) => {
    try {
        await authModel.logoutUserService(req.user.id);
        res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
    } catch (error) {
        console.error('[AUTH] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error interno del servidor.' });
    }
};