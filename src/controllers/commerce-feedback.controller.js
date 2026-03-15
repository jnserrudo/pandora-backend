import * as feedbackModel from '../models/commerce-feedback.model.js';
import prisma from '../db/prismaClient.js';
import * as auditService from '../services/audit.service.js';

// ==================== COMENTARIOS ====================

/**
 * Crear comentario sobre un comercio (público)
 */
export const createComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating, category, userName } = req.body;
    
    // Ya no es login obligatorio, permitimos anónimos
    const userId = req.user ? req.user.id : null;

    // Verificar si el comercio existe y obtener su dueño
    const commerce = await prisma.commerce.findUnique({
      where: { id: parseInt(id) },
      select: { planLevel: true, name: true, ownerId: true }
    });

    if (!commerce) {
      return res.status(404).json({ message: "Comercio no encontrado" });
    }

    // Prevenir auto-comentario del dueño (solo si está logueado)
    if (userId && commerce.ownerId === userId) {
      return res.status(403).json({ message: "No puedes dejar un comentario en tu propio comercio." });
    }

    const commentData = {
      commerceId: parseInt(id),
      comment,
      rating: rating || null,
      category: category || 'OTRO',
      userId: req.user?.id || null,
      userName: req.user ? null : (userName || 'Anónimo')
    };

    const newComment = await feedbackModel.createCommentModel(commentData);

    // Notificar a todos los admins
    await notifyAdminsNewComment(id, newComment);

    res.status(201).json(newComment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Obtener comentarios de un comercio (solo admin)
 */
export const getCommerceComments = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await feedbackModel.getCommerceCommentsModel(id);
    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Marcar comentario como leído
 */
export const markCommentAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await feedbackModel.markCommentAsReadModel(id);
    res.status(200).json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Actualizar notas administrativas de un comentario
 */
export const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const oldComment = await prisma.commerceComment.findUnique({ where: { id: parseInt(id) } });
    const comment = await feedbackModel.updateCommentModel(id, req.body);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'UPDATE',
        resourceType: 'COMMENT',
        resourceId: comment.id,
        oldData: oldComment,
        newData: comment,
        ipAddress: req.ip
    });

    res.status(200).json(comment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Respuesta pública del Comercio al Comentario
 */
export const replyComment = async (req, res) => {
  try {
    const { id } = req.params; // ID del comentario
    const { commerceReply } = req.body;
    const userId = req.user.id;

    // Obtener el comentario para saber a qué comercio pertenece
    const comment = await prisma.commerceComment.findUnique({
      where: { id: parseInt(id) },
      include: { commerce: true }
    });

    if (!comment) return res.status(404).json({ message: "Comentario no encontrado" });

    // Validar propietario (si no es admin)
    if (req.user.role !== 'ADMIN' && comment.commerce.ownerId !== userId) {
      return res.status(403).json({ message: "No tienes permiso para responder en este comercio." });
    }

    // Validar plan de permisos del comercio (Debe ser Plata o superior)
    if (comment.commerce.planLevel < 2) {
      return res.status(403).json({ message: "Tu plan actual no te permite responder comentarios (Requiere Plata o superior)." });
    }

    const oldComment = await prisma.commerceComment.findUnique({ where: { id: parseInt(id) } });
    const updatedComment = await feedbackModel.replyCommentModel(id, commerceReply);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'REPLY',
        resourceType: 'COMMENT',
        resourceId: updatedComment.id,
        oldData: { commerceReply: oldComment.commerceReply },
        newData: { commerceReply },
        ipAddress: req.ip
    });

    res.status(200).json(updatedComment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Eliminar comentario
 */
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const oldComment = await prisma.commerceComment.findUnique({ where: { id: parseInt(id) } });
    await feedbackModel.deleteCommentModel(id);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'DELETE',
        resourceType: 'COMMENT',
        resourceId: parseInt(id),
        oldData: oldComment,
        ipAddress: req.ip
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== ASESORÍAS ====================

/**
 * Crear asesoría para un comercio (solo admin)
 */
export const createAdvisory = async (req, res) => {
  try {
    const { id } = req.params;
    const advisorId = req.user.id;
    
    // Obtener métricas actuales del comercio
    const metrics = await feedbackModel.getCommerceMetrics(id);
    
    const advisory = await feedbackModel.createAdvisoryModel({
      commerceId: parseInt(id),
      advisorId,
      ...req.body,
      metricsSnapshot: metrics
    });

    // Notificar al owner del comercio
    await notifyCommerceOwnerAdvisory(id, advisory);

    res.status(201).json(advisory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Obtener asesorías de un comercio
 * Solo ADMIN o el OWNER del comercio
 */
export const getCommerceAdvisories = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verificar si el usuario es dueño o admin
    const commerce = await prisma.commerce.findUnique({
      where: { id: parseInt(id) },
      select: { ownerId: true }
    });

    if (!commerce) {
      return res.status(404).json({ message: "Comercio no encontrado" });
    }

    if (userRole !== 'ADMIN' && commerce.ownerId !== userId) {
      return res.status(403).json({ message: "No tienes permiso para ver estas asesorías" });
    }

    const advisories = await feedbackModel.getCommerceAdvisoriesModel(id);
    res.status(200).json(advisories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Actualizar estado de asesoría
 * Solo el OWNER del comercio o ADMIN
 */
export const updateAdvisoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Obtener la asesoría para saber a qué comercio pertenece
    const advisory = await prisma.commerceAdvisory.findUnique({
      where: { id: parseInt(id) },
      include: { commerce: true }
    });

    if (!advisory) {
      return res.status(404).json({ message: "Asesoría no encontrada" });
    }

    // Solo el dueño del comercio o un admin puede cambiar el estado
    if (userRole !== 'ADMIN' && advisory.commerce.ownerId !== userId) {
      return res.status(403).json({ message: "No tienes permiso para modificar esta asesoría" });
    }
    
    const oldAdvisory = await prisma.commerceAdvisory.findUnique({ where: { id: parseInt(id) } });
    const updatedAdvisory = await feedbackModel.updateAdvisoryStatusModel(id, status);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'STATUS_CHANGE',
        resourceType: 'ADVISORY',
        resourceId: updatedAdvisory.id,
        oldData: { status: oldAdvisory.status },
        newData: { status },
        ipAddress: req.ip
    });

    res.status(200).json(updatedAdvisory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ==================== MÉTRICAS ====================

/**
 * Obtener métricas de un comercio
 */
export const getCommerceMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const metrics = await feedbackModel.getCommerceMetrics(id);
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== FEATURED COMMERCES ====================

/**
 * Obtener comercios destacados
 */
export const getFeaturedCommerces = async (req, res) => {
  try {
    const commerces = await feedbackModel.getFeaturedCommercesModel();
    res.status(200).json(commerces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Marcar comercio como destacado
 */
export const setCommerceFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;
    
    const oldCommerce = await prisma.commerce.findUnique({ 
        where: { id: parseInt(id) },
        select: { id: true, isFeatured: true, featuredUntil: true }
    });
    const commerce = await feedbackModel.setCommerceFeaturedModel(id, days);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'FEATURED_STATUS',
        resourceType: 'COMMERCE',
        resourceId: commerce.id,
        oldData: oldCommerce,
        newData: { isFeatured: commerce.isFeatured, featuredUntil: commerce.featuredUntil },
        ipAddress: req.ip
    });

    res.status(200).json(commerce);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Notificar a admins sobre nuevo comentario
 */
async function notifyAdminsNewComment(commerceId, comment) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true }
    });

    const commerce = await prisma.commerce.findUnique({
      where: { id: parseInt(commerceId) },
      select: { name: true }
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'NEW_COMMERCE_COMMENT',
          message: `Nuevo comentario en ${commerce.name}: "${comment.comment.substring(0, 50)}..."`,
          referenceId: parseInt(commerceId)
        }
      });
    }
  } catch (error) {
    console.error('Error notificando admins:', error);
  }
}

/**
 * Notificar al owner sobre nueva asesoría
 */
async function notifyCommerceOwnerAdvisory(commerceId, advisory) {
  try {
    const commerce = await prisma.commerce.findUnique({
      where: { id: parseInt(commerceId) },
      select: { ownerId: true, name: true }
    });

    await prisma.notification.create({
      data: {
        userId: commerce.ownerId,
        type: 'NEW_COMMERCE_ADVISORY',
        message: `Nueva asesoría para ${commerce.name}: ${advisory.title}`,
        referenceId: parseInt(commerceId)
      }
    });
  } catch (error) {
    console.error('Error notificando owner:', error);
  }
}
