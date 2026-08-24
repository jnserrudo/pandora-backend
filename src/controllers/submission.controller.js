import * as submissionModel from '../models/submission.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as emailService from '../services/email.service.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';

export const createSubmission = async (req, res) => {
    try {
        const submissionData = {
            ...req.body,
            userId: req.user ? req.user.id : null // Puede ser anónimo (contacto)
        };
        const submission = await submissionModel.createSubmissionModel(submissionData);
        
        // Notificar a ADMINS si es algo crítico
        if (['AD_PROPOSAL', 'MAGAZINE_PROPOSAL', 'PLAN_UPGRADE'].includes(submission.type)) {
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
            for (const admin of admins) {
                await notificationModel.createNotificationModel(
                    admin.id,
                    'NEW_SUBMISSION',
                    `Nueva solicitud (${submission.type}) de ${submission.name || 'usuario'}`,
                    submission.id
                );
            }
        }

        res.status(201).json(submission);
    } catch (error) {
        console.error('[SUBMISSION] Error creando solicitud:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const getSubmissions = async (req, res) => {
    try {
        const submissions = await submissionModel.getAllSubmissionsModel();
        res.status(200).json(submissions);
    } catch (error) {
        console.error('[SUBMISSION] Error obteniendo solicitudes:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const getMySubmissions = async (req, res) => {
    try {
        const submissions = await submissionModel.getSubmissionsByUserIdModel(req.user.id);
        res.status(200).json(submissions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const replySubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminResponse, status } = req.body;
        
        const oldSubmission = await submissionModel.getSubmissionByIdModel(id);
        if (!oldSubmission) throwError('Solicitud no encontrada', 404);

        const submission = await submissionModel.updateSubmissionStatusModel(id, status || 'RESPONDED', adminResponse);

        // --- MANEJO DE EFECTOS SECUNDARIOS ---
        
        // 1. Notificar al usuario del cambio de estado/respuesta
        if (submission.userId && submission.user) {
            // Notificación interna
            await notificationModel.createNotificationModel(
                submission.userId,
                'SUBMISSION_UPDATED',
                `Tu solicitud de tipo ${submission.type} ha sido actualizada a estado: ${submission.status}`,
                submission.id
            );

            // Notificación por EMAIL
            await emailService.notifySubmissionUpdate(
                submission.user.email,
                submission.user.name,
                submission.type,
                submission.status,
                adminResponse
            );
        }

        // 2. Si es un Upgrade de Plan y fue aprobado
        if (submission.type === 'PLAN_UPGRADE' && status === 'APPROVED') {
            const commerce = await prisma.commerce.findFirst({
                where: { ownerId: submission.userId }
            });

            if (commerce) {
                const levelMatch =
                    submission.message.match(/(?:nivel|level|plan)\s*[:=]?\s*([1-4])/i) ||
                    submission.message.match(/\b([2-4])\b/);
                const parsed = levelMatch ? parseInt(levelMatch[1], 10) : 2;
                const newLevel = Number.isFinite(parsed) && parsed >= 1 && parsed <= 4 ? parsed : 2;

                const plan = await prisma.plan.findUnique({ where: { level: newLevel } });

                await prisma.commerce.update({
                    where: { id: commerce.id },
                    data: {
                        planLevel: newLevel,
                        ...(plan && { planId: plan.id })
                    }
                });

                let historyEntry = null;
                if (plan) {
                    historyEntry = await prisma.planHistory.create({
                        data: {
                            commerceId: commerce.id,
                            oldLevel: commerce.planLevel,
                            newLevel: newLevel,
                            planId: plan.id,
                            totalPaid: 0,
                            method: 'OFFER',
                            paymentProof: submission.attachmentUrl
                        }
                    });
                }

                await auditService.createLog({
                    userId: req.user.id,
                    action: 'PLAN_UPGRADE',
                    resourceType: 'COMMERCE',
                    resourceId: commerce.id,
                    oldData: { planLevel: commerce.planLevel },
                    newData: { planLevel: newLevel, planHistoryId: historyEntry?.id || null },
                    req
        });
            }
        }

        res.status(200).json(submission);
    } catch (error) {
        console.error('[SUBMISSION] Error respondiendo solicitud:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const updateSubmissionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const submission = await submissionModel.updateSubmissionStatusModel(id, status);
        res.status(200).json(submission);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
