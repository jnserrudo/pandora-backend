import * as feedbackModel from '../models/commerce-feedback.model.js';
import prisma from '../db/prismaClient.js';

// ==================== COMENTARIOS ====================

/**
 * Crear comentario sobre un comercio (público)
 */
export const createComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating, category, userName } = req.body;
    
    const commentData = {
      commerceId: parseInt(id),
      comment,
      rating: rating || null,
      category: category || 'OTRO',
      userId: req.user?.userId || null,
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
    const comment = await feedbackModel.updateCommentModel(id, req.body);
    res.status(200).json(comment);
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
    await feedbackModel.deleteCommentModel(id);
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
    const advisorId = req.user.userId;
    
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
    const userId = req.user.userId;
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
    const userId = req.user.userId;
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
    
    const updatedAdvisory = await feedbackModel.updateAdvisoryStatusModel(id, status);
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
    
    const commerce = await feedbackModel.setCommerceFeaturedModel(id, days);
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
          referenceId: comment.id
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
        type: 'NEW_ADVISORY',
        message: `Nueva asesoría para ${commerce.name}: ${advisory.title}`,
        referenceId: advisory.id
      }
    });
  } catch (error) {
    console.error('Error notificando owner:', error);
  }
}
