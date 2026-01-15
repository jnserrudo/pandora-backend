import prisma from '../db/prismaClient.js';

export const createContactRequestModel = async (data) => {
    return await prisma.contactRequest.create({
        data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            interestType: data.interestType,
            message: data.message,
            status: 'PENDING'
        }
    });
};
