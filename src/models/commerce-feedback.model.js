import prisma from '../db/prismaClient.js';

// ==================== COMENTARIOS ====================

/**
 * Crear un comentario sobre un comercio
 */
export const createCommentModel = async (data) => {
  const comment = await prisma.commerceComment.create({
    data,
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  });

  //  Actualizar métricas del comercio
  await updateCommerceMetrics(data.commerceId);

  return comment;
};

/**
 * Obtener todos los comentarios de un comercio
 */
export const getCommerceCommentsModel = async (commerceId) => {
  return await prisma.commerceComment.findMany({
    where: { commerceId: parseInt(commerceId) },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  });
};

/**
 * Marcar comentario como leído
 */
export const markCommentAsReadModel = async (id) => {
  return await prisma.commerceComment.update({
    where: { id: parseInt(id) },
    data: { isRead: true }
  });
};

/**
 * Actualizar notas administrativas de un comentario
 */
export const updateCommentModel = async (id, data) => {
  return await prisma.commerceComment.update({
    where: { id: parseInt(id) },
    data: {
      adminNotes: data.adminNotes,
      priority: data.priority
    }
  });
};

/**
 * Eliminar comentario (solo admin)
 */
export const deleteCommentModel = async (id) => {
  const comment = await prisma.commerceComment.delete({
    where: { id: parseInt(id) }
  });

  // Actualizar métricas del comercio
  await updateCommerceMetrics(comment.commerceId);

  return comment;
};

/**
 * Obtener comentarios no leídos (para notificaciones)
 */
export const getUnreadCommentsModel = async () => {
  return await prisma.commerceComment.count({
    where: { isRead: false }
  });
};

// ==================== ASESORÍAS ====================

/**
 * Crear asesoría para un comercio
 */
export const createAdvisoryModel = async (data) => {
  return await prisma.commerceAdvisory.create({
    data,
    include: {
      advisor: {
        select: { id: true, name: true }
      },
      commerce: {
        select: { id: true, name: true, ownerId: true }
      }
    }
  });
};

/**
 * Obtener asesorías de un comercio
 */
export const getCommerceAdvisoriesModel = async (commerceId) => {
  return await prisma.commerceAdvisory.findMany({
    where: { commerceId: parseInt(commerceId) },
    orderBy: { createdAt: 'desc' },
    include: {
      advisor: {
        select: { id: true, name: true }
      }
    }
  });
};

/**
 * Marcar asesoría como leída/implementada
 */
export const updateAdvisoryStatusModel = async (id, status) => {
  return await prisma.commerceAdvisory.update({
    where: { id: parseInt(id) },
    data: {
      status,
      ...(status === 'IMPLEMENTED' && { implementedAt: new Date() })
    }
  });
};

// ==================== MÉTRICAS ====================

/**
 * Obtener métricas completas de un comercio
 */
export const getCommerceMetrics = async (commerceId) => {
  const [comments, advertisements, commerce] = await Promise.all([
    prisma.commerceComment.aggregate({
      where: { commerceId: parseInt(commerceId) },
      _count: true,
      _avg: { rating: true }
    }),
    prisma.advertisement.aggregate({
      where: { commerceId: parseInt(commerceId) },
      _sum: { impressions: true, clicks: true }
    }),
    prisma.commerce.findUnique({
      where: { id: parseInt(commerceId) },
      select: { planLevel: true }
    })
  ]);

  const impressions = advertisements._sum.impressions || 0;
  const clicks = advertisements._sum.clicks || 0;

  return {
    totalComments: comments._count || 0,
    averageRating: comments._avg.rating || 0,
    impressions,
    clicks,
    ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00',
    planLevel: commerce?.planLevel || 1
  };
};

/**
 * Actualizar métricas agregadas del comercio
 */
async function updateCommerceMetrics(commerceId) {
  const metrics = await getCommerceMetrics(commerceId);
  
  await prisma.commerce.update({
    where: { id: parseInt(commerceId) },
    data: {
      totalComments: metrics.totalComments,
      averageRating: metrics.averageRating
    }
  });
}

// ==================== FEATURED COMMERCES ====================

/**
 * Obtener comercios destacados (beneficio por plan)
 */
export const getFeaturedCommercesModel = async () => {
  return await prisma.commerce.findMany({
    where: {
      isFeatured: true,
      featuredUntil: { gte: new Date() },
      planLevel: { gte: 3 }, // Solo planes Premium o superiores
      status: 'ACTIVE',
      isActive: true
    },
    orderBy: { planLevel: 'desc' },
    take: 6,
    include: {
      owner: {
        select: { name: true }
      }
    }
  });
};

/**
 * Marcar comercio como destacado (admin)
 */
export const setCommerceFeaturedModel = async (commerceId, days = 7) => {
  const featuredUntil = new Date();
  featuredUntil.setDate(featuredUntil.getDate() + days);

  return await prisma.commerce.update({
    where: { id: parseInt(commerceId) },
    data: {
      isFeatured: true,
      featuredUntil
    }
  });
};

/**
 * Desmarcar comercio destacado
 */
export const unsetCommerceFeaturedModel = async (commerceId) => {
  return await prisma.commerce.update({
    where: { id: parseInt(commerceId) },
    data: {
      isFeatured: false,
      featuredUntil: null
    }
  });
};
