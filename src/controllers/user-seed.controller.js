import prisma from '../db/prismaClient.js';
import bcrypt from 'bcryptjs';

/**
 * Utilidad para cargar usuarios de prueba de forma masiva
 */
export const seedTestUsers = async (req, res) => {
    try {
        const { count = 10, role = 'USER' } = req.body;
        const users = [];
        const hashedPassword = await bcrypt.hash('password123', 10);

        for (let i = 0; i < count; i++) {
            const timestamp = Date.now() + i;
            users.push({
                name: `Test User ${timestamp}`,
                username: `testuser_${timestamp}`,
                email: `test_${timestamp}@example.com`,
                password: hashedPassword,
                role: role,
                isActive: true
            });
        }

        // Usamos createMany para eficiencia
        const result = await prisma.user.createMany({
            data: users,
            skipDuplicates: true
        });

        res.status(201).json({
            message: `${result.count} usuarios de prueba creados exitosamente.`,
            details: `Contraseña para todos: password123`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
