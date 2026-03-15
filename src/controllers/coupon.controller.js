import * as couponModel from '../models/coupon.model.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';

export const getCoupons = async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const coupons = await couponModel.getCouponsModel(showAll);
    res.status(200).json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const created = await couponModel.createCouponModel(req.body);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'CREATE',
        resourceType: 'COUPON',
        resourceId: created.id,
        newData: created,
        ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const oldCoupon = await prisma.coupon.findUnique({ where: { id: parseInt(req.params.id) } });
    const updated = await couponModel.updateCouponModel(req.params.id, req.body);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'UPDATE',
        resourceType: 'COUPON',
        resourceId: updated.id,
        oldData: oldCoupon,
        newData: updated,
        ipAddress: req.ip
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const oldCoupon = await prisma.coupon.findUnique({ where: { id: parseInt(req.params.id) } });
    await couponModel.deleteCouponModel(req.params.id);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'DELETE',
        resourceType: 'COUPON',
        resourceId: parseInt(req.params.id),
        oldData: oldCoupon,
        ipAddress: req.ip
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const validateCoupon = async (req, res) => {
  try {
    const coupon = await couponModel.validateCouponModel(req.body.code);
    if (!coupon) {
      return res.status(404).json({ message: "Cupón inválido o expirado." });
    }
    res.status(200).json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
