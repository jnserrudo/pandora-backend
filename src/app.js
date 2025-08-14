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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); // <-- 2. APLICA EL MIDDLEWARE

app.get('/', (req, res) => res.send('Welcome to the API!'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', articleRoutes);
app.use('/api', commerceRoutes);
app.use('/api', eventRoutes);
app.use('/api', searchRoutes);

const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});
process.on('beforeExit', async () => await prisma.$disconnect());