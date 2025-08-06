import 'dotenv/config';
import express from 'express';
import prisma from './db/prismaClient.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import articleRoutes from './routes/article.routes.js';
import commerceRoutes from './routes/commerce.routes.js';
import eventRoutes from './routes/event.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get('/', (req, res) => res.send('Welcome to the API!'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', articleRoutes);
app.use('/api', commerceRoutes);
app.use('/api', eventRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
process.on('beforeExit', async () => await prisma.$disconnect());