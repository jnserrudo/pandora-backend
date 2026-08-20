import rateLimit from 'express-rate-limit';

const skipInTest = () => process.env.NODE_ENV === 'test';

export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    skip: skipInTest,
    message: { message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.' },
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skip: skipInTest,
    message: { message: 'Demasiados intentos de autenticación, por favor intenta de nuevo más tarde.' },
});

export const resendEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    skip: skipInTest,
    message: { message: 'Has superado el límite de reenvío de correos. Intenta más tarde.' },
});

export const assistantLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: (req) => {
        if (process.env.TEST_ASSISTANT_LIMIT === '1') return 1;
        return req.user ? 40 : 20;
    },
    skip: () => process.env.NODE_ENV === 'test' && process.env.TEST_ASSISTANT_LIMIT !== '1',
    message: { message: 'Demasiadas consultas al asistente. Probá de nuevo más tarde.' },
});
