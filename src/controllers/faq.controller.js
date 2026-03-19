import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import * as auditService from '../services/audit.service.js';

export const getFAQsByCommerceId = async (req, res) => {
    try {
        const { commerceId } = req.params;
        const faqs = await prisma.faq.findMany({
            where: { commerceId: parseInt(commerceId) },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(faqs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createFAQ = async (req, res) => {
    try {
        const { commerceId } = req.params;
        const { question, answer } = req.body;

        const commerce = await prisma.commerce.findUnique({
            where: { id: parseInt(commerceId) },
            select: { planLevel: true, ownerId: true }
        });

        if (!commerce || commerce.planLevel < 3) {
            throwError('Tu plan actual no permite gestionar FAQs.', 403);
        }

        const faq = await prisma.faq.create({
            data: {
                commerceId: parseInt(commerceId),
                question,
                answer
            }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'FAQ',
            resourceId: faq.id,
            newData: faq,
            ipAddress: req.ip
        });

        res.status(201).json(faq);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateFAQ = async (req, res) => {
    try {
        const { commerceId, id } = req.params;
        const { question, answer } = req.body;

        const commerce = await prisma.commerce.findUnique({
            where: { id: parseInt(commerceId) },
            select: { planLevel: true, ownerId: true }
        });

        if (!commerce || commerce.planLevel < 3) {
            throwError('Tu plan actual no permite gestionar FAQs.', 403);
        }

        const oldFaq = await prisma.faq.findUnique({ where: { id: parseInt(id) } });
        const faq = await prisma.faq.update({
            where: { id: parseInt(id) },
            data: { question, answer }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'FAQ',
            resourceId: faq.id,
            oldData: oldFaq,
            newData: faq,
            ipAddress: req.ip
        });

        res.status(200).json(faq);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteFAQ = async (req, res) => {
    try {
        const { commerceId, id } = req.params;

        const commerce = await prisma.commerce.findUnique({
            where: { id: parseInt(commerceId) },
            select: { planLevel: true, ownerId: true }
        });

        if (!commerce || commerce.planLevel < 3) {
            throwError('Tu plan actual no permite gestionar FAQs.', 403);
        }

        const oldFaq = await prisma.faq.findUnique({ where: { id: parseInt(id) } });
        await prisma.faq.delete({
            where: { id: parseInt(id) }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'FAQ',
            resourceId: parseInt(id),
            oldData: oldFaq,
            ipAddress: req.ip
        });

        res.status(200).json({ message: 'FAQ eliminada exitosamente' });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
