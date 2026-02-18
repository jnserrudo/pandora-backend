import prisma from '../db/prismaClient.js';

export const getPlansModel = async () => {
  return prisma.plan.findMany({
    orderBy: { level: 'asc' }
  });
};

export const updatePlanModel = async (id, data) => {
  const level = parseInt(data.level) || 1;
  return prisma.plan.upsert({
    where: { level: level },
    update: {
      price: parseFloat(data.price),
      name: data.name,
      description: data.description,
      benefits: data.benefits
    },
    create: {
      level: level,
      price: parseFloat(data.price),
      name: data.name,
      description: data.description || '',
      benefits: data.benefits || ''
    }
  });
};

export const getPaymentHistoryModel = async () => {
  return prisma.planHistory.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      commerce: { select: { name: true } }
    }
  });
};
