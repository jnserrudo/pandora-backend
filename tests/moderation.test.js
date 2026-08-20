import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const prisma = {
  moderationLog: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

const classifyContent = jest.fn();
const analyzeImages = jest.fn();
const isAiConfigured = jest.fn(() => true);

jest.unstable_mockModule('../src/db/prismaClient.js', () => ({ default: prisma }));
jest.unstable_mockModule('../src/services/ai.service.js', () => ({
  classifyContent,
  analyzeImages,
  isAiConfigured,
  chatCompletion: jest.fn(),
  getAiRuntimeStatus: jest.fn(),
  stripThinking: (t) => String(t || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim(),
}));

const { moderateContent } = await import('../src/services/moderation.service.js');
const ai = await import('../src/services/ai.service.js');

describe('AI Guard', () => {
  beforeEach(() => {
    prisma.moderationLog.create.mockReset();
    prisma.moderationLog.create.mockResolvedValue({ id: 77 });
    classifyContent.mockReset();
    analyzeImages.mockReset();
    classifyContent.mockResolvedValue({ skipped: true });
    analyzeImages.mockResolvedValue({ skipped: true });
  });

  it('marca estafa para el admin, sin bloquear el alta (filtro + IA)', async () => {
    const result = await moderateContent('Oferta de estafa millonaria', 'COMMERCE');
    expect(result.approved).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(['FLAGGED', 'REJECTED']).toContain(result.status);
    expect(classifyContent).toHaveBeenCalled();
    expect(prisma.moderationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'COMMERCE',
          status: expect.stringMatching(/FLAGGED|REJECTED/),
        }),
      })
    );
  });

  it('FLAGGED de Groq deja crear pero pide revisión', async () => {
    classifyContent.mockResolvedValue({ skipped: false, status: 'FLAGGED', reason: 'Muy promocional' });
    const result = await moderateContent('El mejor local increíble descuentos', 'COMMERCE');
    expect(result.approved).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.status).toBe('FLAGGED');
    expect(result.logId).toBe(77);
  });

  it('REJECTED de Groq no bloquea el alta: queda en cola', async () => {
    classifyContent.mockResolvedValue({ skipped: false, status: 'REJECTED', reason: 'Phishing' });
    const result = await moderateContent('Pasá tu tarjeta acá', 'EVENT');
    expect(result.approved).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.status).toBe('REJECTED');
  });

  it('visión REJECTED gana sobre texto APPROVED y no bloquea el alta', async () => {
    classifyContent.mockResolvedValue({ skipped: false, status: 'APPROVED' });
    analyzeImages.mockResolvedValue({ skipped: false, status: 'REJECTED', reason: 'Imagen explícita' });
    const result = await moderateContent('Café del centro', 'COMMERCE', null, ['/seed/cafe-cover.png']);
    expect(result.approved).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.status).toBe('REJECTED');
  });

  it('limpia bloques thinking de Qwen', () => {
    expect(ai.stripThinking('<thinking>interno</thinking>\n{"status":"APPROVED"}')).toBe('{"status":"APPROVED"}');
  });
});
