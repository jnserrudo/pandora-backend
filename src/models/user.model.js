import prisma from '../db/prismaClient.js';

const throwError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
};

export const getCurrentUserModel = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
    });
    if (!user) throwError('User not found.', 404);
    return user;
};

export const updateCurrentUserModel = async (userId, updateData) => {
    const { role, password, ...allowedUpdates } = updateData;
    if (allowedUpdates.username || allowedUpdates.email) {
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email: allowedUpdates.email }, { username: allowedUpdates.username }], NOT: { id: userId } },
        });
        if (existingUser) throwError(existingUser.email === allowedUpdates.email ? 'Email is already taken.' : 'Username is already taken.', 409);
    }
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: allowedUpdates,
        select: { id: true, email: true, username: true, name: true, role: true },
    });
    return updatedUser;
};