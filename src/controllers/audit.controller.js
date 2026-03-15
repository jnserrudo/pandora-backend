import prisma from '../db/prismaClient.js';

export const getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            }),
            prisma.auditLog.count()
        ]);

        res.status(200).json({
            logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ message: "Error interno al recuperar los logs de auditoría" });
    }
};

export const getAuditLogById = async (req, res) => {
    try {
        const { id } = req.params;
        const log = await prisma.auditLog.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        if (!log) {
            return res.status(404).json({ message: "Log no encontrado" });
        }

        res.status(200).json(log);
    } catch (error) {
        res.status(500).json({ message: "Error al recuperar el detalle del log" });
    }
};
