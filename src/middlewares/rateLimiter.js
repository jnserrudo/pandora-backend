import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 100, 
    message: { message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.' },
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, // A bit of headroom for dev
    message: { message: 'Demasiados intentos de autenticación, por favor intenta de nuevo más tarde.' },
});

export const resendEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 3, 
    message: { message: 'Has superado el límite de reenvío de correos. Intenta más tarde.' },
});
