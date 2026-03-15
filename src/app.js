import 'dotenv/config';
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); // <-- 2. APLICA EL MIDDLEWARE

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

const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});
process.on('beforeExit', async () => await prisma.$disconnect());