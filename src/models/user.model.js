import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';

/**
 * Obtiene el perfil público de un usuario por su ID.
 * Se excluyen datos sensibles como la contraseña y el refresh token.
 * @param {number} userId - El ID del usuario.
 * @returns {Promise<Object>} El perfil del usuario.
 */
export const getUserProfileModel = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            commerces: {
                where: { isActive: true }
            }
        }
    });
    
    // Si el usuario no existe o está inactivo lógicamente
    if (!user || !user.isActive) {
        throwError('Usuario no encontrado o inactivo.', 404);
    }

    if (user) {
        delete user.password;
        delete user.refreshToken;
    }

    return user;
};

/**
 * Actualiza el perfil de un usuario.
 * @param {number} userId - El ID del usuario a actualizar.
 * @param {object} data - Los datos a actualizar.
 * @returns {Promise<Object>} El perfil actualizado.
 */
export const updateUserProfileModel = async (userId, data) => {
    // Excluimos campos que un usuario no debería poder cambiar directamente.
    const { id, role, password, ...updateData } = data;

    // Opcional: Verificar si el nuevo email o username ya está en uso por otro usuario.
    if (updateData.email || updateData.username) {
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: updateData.email }, { username: updateData.username }],
                NOT: { id: parseInt(userId) },
            },
        });
        if (existingUser) {
            const message = existingUser.email === updateData.email ? 'El email ya está en uso.' : 'El nombre de usuario ya está en uso.';
            throwError(message, 409);
        }
    }

    try {
        return await prisma.user.update({
            where: { id: parseInt(userId) },
            data: updateData,
            select: { // Devolvemos el perfil sin datos sensibles
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
            },
        });
    } catch (error) {
        if (error.code === 'P2025') {
            throwError('Usuario no encontrado.', 404);
        }
        throw error;
    }
};