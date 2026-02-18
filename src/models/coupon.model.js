import prisma from '../db/prismaClient.js';

export const getCouponsModel = async (showAll = false) => {
  const where = showAll ? {} : { isActive: true };
  return prisma.coupon.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
};

export const createCouponModel = async (data) => {
  return prisma.coupon.create({
    data: {
      code: data.code.toUpperCase(),
      discountPercent: parseInt(data.discountPercent),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true
    }
  });
};

export const updateCouponModel = async (id, data) => {
  const updateData = {};
  if (data.code) updateData.code = data.code.toUpperCase();
  if (data.discountPercent !== undefined) updateData.discountPercent = parseInt(data.discountPercent);
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  return prisma.coupon.update({
    where: { id: parseInt(id) },
    data: updateData
  });
};

export const deleteCouponModel = async (id) => {
  // Siguiendo la política de borrado lógico
  return prisma.coupon.update({
    where: { id: parseInt(id) },
    data: { isActive: false }
  });
};

export const validateCouponModel = async (code) => {
  const now = new Date();
  return prisma.coupon.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } }
      ]
    }
  });
};
