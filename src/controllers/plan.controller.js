import * as planModel from '../models/plan.model.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';

export const getPlans = async (req, res) => {
  try {
    const plans = await planModel.getPlansModel();
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const oldPlan = await prisma.plan.findUnique({ where: { id: parseInt(req.params.id) } });
    const updated = await planModel.updatePlanModel(req.params.id, req.body);
    
    // Auditoría
    await auditService.createLog({
        userId: req.user.id,
        action: 'UPDATE',
        resourceType: 'PLAN',
        resourceId: updated.id,
        oldData: oldPlan,
        newData: updated,
        ipAddress: req.ip
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const history = await planModel.getPaymentHistoryModel();
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
