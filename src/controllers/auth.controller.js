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
        console.log(`[AUTH] Datos recibidos - Email: ${email}, Username: ${username}, Name: ${name}`);
        
        if (!email || !username || !password || !name) {
            console.log(`[AUTH] ❌ Datos incompletos en registro`);
            return res.status(400).json({ message: 'Email, username, name, and password are required.' });
        }
        
        // Pass the body to the service
        console.log(`[AUTH] Llamando a registerUserService...`);
        const { user: newUser, otpCode } = await authModel.registerUserService(req.body);
        console.log(`[AUTH] ✅ Usuario creado en DB - ID: ${newUser.id}, Email: ${newUser.email}`);
        console.log(`[AUTH] OTP generado: ${otpCode}`);
        
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
            console.error(`[AUTH] Tipo de error: ${err.name}, Código: ${err.code}`);
            
            if (err instanceof EmailTimeoutError) {
                console.log(`[AUTH] ⏱️  Timeout detectado - se habilitará reenvío`);
            }
        }
        
        const duration = Date.now() - requestStart;
        console.log(`[AUTH] Proceso completado en ${duration}ms`);
        console.log(`[AUTH] Email enviado: ${emailSent}`);
        console.log(`[AUTH] CanResendOTP: ${!emailSent}`);
        
        // Responder al cliente
        const response = { 
            message: emailSent 
                ? 'User registered successfully! Please check your email.' 
                : 'User registered successfully! However, we could not send the verification email. Please use the "Resend Code" option or use the code shown below.',
            user: newUser,
            emailSent: emailSent,
            canResendOTP: !emailSent,
            debugOTP: !emailSent ? otpCode : undefined,
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
            ipAddress: req.ip
        });
        
        console.log(`[AUTH] ==========================================`);
    } catch (error) {
        const duration = Date.now() - requestStart;
        console.error(`[AUTH] ❌ Error en registro después de ${duration}ms:`, error.message);
        console.error(`[AUTH] Stack:`, error.stack);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Internal server error.',
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
            return res.status(400).json({ message: 'Email is required.' });
        }

        // Generar nuevo OTP
        const { user, otpCode } = await authModel.resendOTPService(email);
        console.log('🔄 Reenviando OTP a:', user.email);

        // Intentar enviar el email
        let emailSent = false;
        let emailError = null;

        try {
            await sendVerificationOTP(user.email, otpCode);
            emailSent = true;
            console.log('✅ OTP reenviado exitosamente a:', user.email);
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
            ipAddress: req.ip
        });
    } catch (error) {
        console.log(error);
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
            return res.status(400).json({ message: 'Identifier (email or username) and password are required.' });
        }
        const tokens = await authModel.loginUserService(identifier, password, captchaToken);
        console.log('logeado');
        res.status(200).json({ message: 'Login successful!', ...tokens });

        // Auditoría
        const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
        await auditService.createLog({
            userId: user?.id,
            action: 'LOGIN',
            resourceType: 'USER',
            resourceId: user?.id,
            ipAddress: req.ip
        });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Internal server error.',
            requireCaptcha: error.requireCaptcha,
            isVerified: error.isVerified
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required.' });
        }
        const result = await authModel.verifyOTPService(email, otp);
        res.status(200).json({ message: 'Cuenta verificada con éxito', ...result });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await authModel.refreshAccessTokenService(refreshToken);
        console.log('refresh');
        res.status(200).json(result);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};

export const logoutUser = async (req, res) => {
    try {
        await authModel.logoutUserService(req.user.id);
        console.log('logout');
        res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};