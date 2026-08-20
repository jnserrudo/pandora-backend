import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors'; // <-- 1. IMPORTA EL PAQUETE

import prisma from './db/prismaClient.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import articleRoutes from './routes/article.routes.js';
import commerceRoutes from './routes/commerce.routes.js';
import eventRoutes from './routes/event.routes.js';
import searchRoutes from './routes/search.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import advertisementRoutes from './routes/advertisement.routes.js';
import contactRoutes from './routes/contact.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import submissionRoutes from './routes/submission.routes.js';
import adminRoutes from './routes/admin.routes.js';
import planRoutes from './routes/plan.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import commerceFeedbackRoutes from './routes/commerce-feedback.routes.js';
import searchAnalyticsRoutes from './routes/search-analytics.routes.js';
import publicRoutes from './routes/public.routes.js';
import faqRoutes from './routes/faq.routes.js';
import categoryRoutes from './routes/category.routes.js';
import auditRoutes from './routes/audit.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import assistantRoutes from './routes/assistant.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar trust proxy para Cloudflare/Render
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')));

// CORS: permitir dominios configurados + localhost con cualquier puerto
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.MOBILE_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir sin origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Permitir localhost con cualquier puerto
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^http:\/\/\[::1\](:\d+)?$/.test(origin)) return callback(null, true);
    // Permitir dominios configurados en .env
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.get('/', (req, res) => res.send('Welcome to the API!'));

app.use('/stats-public', publicRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', articleRoutes);
app.use('/api', commerceRoutes);
app.use('/api', eventRoutes);
app.use('/api', searchRoutes);
app.use('/api', uploadRoutes);
app.use('/api', advertisementRoutes);
app.use('/api', contactRoutes);
app.use('/api', notificationRoutes);
app.use('/api', submissionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', planRoutes);
app.use('/api', couponRoutes);
app.use('/api/feedback', commerceFeedbackRoutes);
app.use('/api/search-analytics', searchAnalyticsRoutes);
app.use('/api', faqRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', favoriteRoutes);
app.use('/api/ai', assistantRoutes);

export default app;

if (process.env.NODE_ENV !== 'test') {
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
            throw new Error('JWT_SECRET y REFRESH_TOKEN_SECRET son obligatorios en production.');
        }
        if (!process.env.TURNSTILE_SECRET_KEY) {
            console.error('[BOOT] TURNSTILE_SECRET_KEY falta en production. El captcha va a rechazar registros/logins.');
        }
    }

    const HOST = '0.0.0.0';
    app.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
    });
    process.on('beforeExit', async () => await prisma.$disconnect());
}