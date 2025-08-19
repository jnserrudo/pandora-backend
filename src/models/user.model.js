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
        // Eliminamos el 'select' y dejamos solo el 'include'
        include: {
            commerces: true 
        }
    });
    
    // Prisma es inteligente y no devolverá el campo 'password' por defecto
    // si no lo pides explícitamente, por lo que no necesitas el 'select' para ocultarlo.
    // Si quisieras ser extra seguro, puedes eliminarlo manualmente antes de devolverlo.
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
            const message = existingUser.email === updateData.email ? 'Email is already taken.' : 'Username is already taken.';
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
        console.log(error);
        if (error.code === 'P2025') {
            console.log('User not found.');
            throwError('User not found.', 404);
        }
        throw error;
    }
};