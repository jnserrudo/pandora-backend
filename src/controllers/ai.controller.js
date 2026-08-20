import * as moderationService from '../services/moderation.service.js';
import { chatCompletion, getAiRuntimeStatus } from '../services/ai.service.js';
import { toPublicAiError } from '../utils/ai-errors.js';

export const getAiStatus = async (_req, res) => {
  res.status(200).json(getAiRuntimeStatus());
};

export const getModerationStats = async (_req, res) => {
  try {
    const stats = await moderationService.getModerationStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getFlaggedModeration = async (_req, res) => {
  try {
    const items = await moderationService.getFlaggedContent();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getModerationLogs = async (req, res) => {
  try {
    const items = await moderationService.getModerationLogs(req.query.status || 'pending');
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const reviewModeration = async (req, res) => {
  try {
    const { action, adminNotes } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action debe ser approve o reject' });
    }
    const updated = await moderationService.reviewFlaggedLog(
      req.params.id,
      req.user.id,
      action,
      adminNotes
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const postAiChat = async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Enviá un array messages con al menos un mensaje' });
    }
    const reply = await chatCompletion(messages);
    res.status(200).json({ reply });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error('[AI CHAT]', error.message);
    const publicError = toPublicAiError(error);
    res.status(publicError.statusCode).json({ message: publicError.message });
  }
};
