import { describe, it, expect, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

function createPrismaMock() {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    commerce: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    branch: { create: jest.fn() },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    event: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    submission: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    planHistory: { create: jest.fn() },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    article: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    advertisement: { findMany: jest.fn().mockResolvedValue([]) },
    favorite: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (cb) => {
    if (typeof cb === 'function') return cb(prisma);
    return Promise.all(cb);
  });
  return prisma;
}

const prisma = createPrismaMock();
const moderateContent = jest.fn().mockResolvedValue({ approved: true, requiresReview: false });
const chatCompletion = jest.fn().mockResolvedValue('Usá criterio de Salta y pedí fotos reales.');

jest.unstable_mockModule('../src/db/prismaClient.js', () => ({ default: prisma }));
jest.unstable_mockModule('../src/services/email.service.js', () => ({
  sendVerificationOTP: jest.fn(async () => {
    if (process.env.TEST_FAIL_EMAIL === 'true') {
      throw new Error('brevo down');
    }
    return true;
  }),
  notifyNewCommerceSubmission: jest.fn().mockResolvedValue(true),
  notifyCommerceStatusUpdate: jest.fn().mockResolvedValue(true),
  notifySubmissionUpdate: jest.fn().mockResolvedValue(true),
  EmailTimeoutError: class EmailTimeoutError extends Error {},
}));
jest.unstable_mockModule('../src/services/moderation.service.js', () => ({
  moderateContent,
  attachModerationResource: jest.fn(),
  collectImageUrls: jest.fn(() => []),
  getFlaggedContent: jest.fn().mockResolvedValue([]),
  getModerationLogs: jest.fn().mockResolvedValue([]),
  getModerationStats: jest.fn().mockResolvedValue({
    total: 3, approved: 1, flagged: 1, rejected: 1, pendingReview: 1, approvalRate: '33.3', ai: { configured: false }
  }),
  reviewFlaggedLog: jest.fn().mockResolvedValue({ id: 9, status: 'APPROVED' }),
}));
jest.unstable_mockModule('../src/services/ai.service.js', () => ({
  isAiConfigured: jest.fn(() => false),
  getAiRuntimeStatus: jest.fn(() => ({ configured: false, provider: 'groq', textModel: 'qwen/qwen3.6-27b', visionModel: 'qwen/qwen3.6-27b', hasKey: false })),
  classifyContent: jest.fn().mockResolvedValue({ skipped: true }),
  analyzeImages: jest.fn().mockResolvedValue({ skipped: true }),
  chatCompletion,
  stripThinking: (t) => t,
}));
jest.unstable_mockModule('../src/services/audit.service.js', () => ({
  createLog: jest.fn().mockResolvedValue({ id: 1 }),
}));

const { default: app } = await import('../src/app.js');
const api = request(app);
const password = 'Password1!';

function authHeader(user) {
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { Authorization: `Bearer ${token}` };
}

const user = { id: 5, username: 'socio', role: 'USER' };
const owner = { id: 8, username: 'dueno', role: 'OWNER' };
const admin = { id: 1, username: 'admin', role: 'ADMIN' };

describe('Auth', () => {
  it('registra usuario y deja isVerified=false', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: 10,
      email: 'nuevo@test.com',
      username: 'nuevo',
      name: 'Nuevo',
      role: 'USER',
      isVerified: false,
    });
    prisma.verificationToken.create.mockResolvedValueOnce({ id: 1 });

    const res = await api.post('/api/auth/register').send({
      email: 'nuevo@test.com',
      username: 'nuevo',
      name: 'Nuevo',
      password,
      captchaToken: 'test',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.isVerified).toBe(false);
  });

  it('no incluye debugOTP si el email falla', async () => {
    process.env.TEST_FAIL_EMAIL = 'true';
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: 11,
      email: 'otpfail@test.com',
      username: 'otpfail',
      name: 'Otp Fail',
      role: 'USER',
      isVerified: false,
    });
    prisma.verificationToken.create.mockResolvedValueOnce({ id: 2 });

    const res = await api.post('/api/auth/register').send({
      email: 'otpfail@test.com',
      username: 'otpfail',
      name: 'Otp Fail',
      password,
      captchaToken: 'test',
    });

    delete process.env.TEST_FAIL_EMAIL;
    expect(res.status).toBe(201);
    expect(res.body.emailSent).toBe(false);
    expect(res.body.debugOTP).toBeUndefined();
  });

  it('rechaza password débil', async () => {
    const res = await api.post('/api/auth/register').send({
      email: 'weak@test.com',
      username: 'weak',
      name: 'Weak',
      password: '123456',
      captchaToken: 'test',
    });
    expect(res.status).toBe(400);
  });

  it('login exitoso devuelve access y refresh token', async () => {
    const hashed = await bcrypt.hash(password, 10);
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 1,
      email: 'user@test.com',
      username: 'user',
      password: hashed,
      role: 'USER',
      isVerified: true,
      failedLoginAttempts: 0,
    });
    prisma.user.update.mockResolvedValue({});

    const res = await api.post('/api/auth/login').send({
      identifier: 'user@test.com',
      password,
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('tras 3 fallos exige captcha', async () => {
    const hashed = await bcrypt.hash(password, 10);
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 1,
      email: 'user@test.com',
      username: 'user',
      password: hashed,
      role: 'USER',
      isVerified: true,
      failedLoginAttempts: 3,
    });

    const res = await api.post('/api/auth/login').send({
      identifier: 'user@test.com',
      password,
    });

    expect(res.status).toBe(403);
    expect(res.body.requireCaptcha).toBe(true);
  });

  it('ruta protegida sin token responde 401', async () => {
    const res = await api.get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('USER no accede a rutas ADMIN', async () => {
    const res = await api.get('/api/submissions').set(authHeader(user));
    expect(res.status).toBe(403);
  });
});

describe('Comercios', () => {
  it('USER crea comercio en PENDING', async () => {
    prisma.commerce.findUnique.mockResolvedValueOnce(null);
    prisma.commerce.create.mockResolvedValueOnce({
      id: 99,
      name: 'Cafe Test',
      status: 'PENDING',
      ownerId: user.id,
      planLevel: 1,
      isActive: true,
      categories: [],
    });
    prisma.branch.create.mockResolvedValueOnce({ id: 1, name: 'Casa Central' });

    const res = await api.post('/api/commerces').set(authHeader(user)).send({
      name: 'Cafe Test',
      description: 'Un cafe de prueba en Salta',
      address: 'Caseros 100',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
  });

  it('AI Guard no bloquea el alta: intercepta y deja crear', async () => {
    moderateContent.mockResolvedValueOnce({
      approved: true,
      requiresReview: true,
      status: 'FLAGGED',
      reason: 'Contenido inapropiado detectado (palabra prohibida)',
    });
    prisma.commerce.findUnique.mockResolvedValueOnce(null);
    prisma.commerce.create.mockResolvedValueOnce({
      id: 88,
      name: 'Local estafa',
      status: 'PENDING',
      ownerId: user.id,
      planLevel: 1,
      isActive: true,
      categories: [],
    });
    prisma.branch.create.mockResolvedValueOnce({ id: 2, name: 'Casa Central' });
    const res = await api.post('/api/commerces').set(authHeader(user)).send({
      name: 'Local estafa',
      description: 'Oferta de estafa',
      address: 'Caseros 1',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(moderateContent).toHaveBeenCalled();
  });

  it('listado público no incluye PENDING', async () => {
    prisma.commerce.findMany.mockResolvedValueOnce([
      { id: 1, name: 'Activo', status: 'ACTIVE', isActive: true, planLevel: 3 },
    ]);

    const res = await api.get('/api/commerces');
    expect(res.status).toBe(200);
    const where = prisma.commerce.findMany.mock.calls.at(-1)[0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.isActive).toBe(true);
  });

  it('ADMIN ve comercios incluyendo PENDING', async () => {
    prisma.commerce.findMany.mockResolvedValueOnce([
      { id: 7, name: 'Pendiente', status: 'PENDING' },
    ]);
    const res = await api.get('/api/commerces').set(authHeader(admin));
    expect(res.status).toBe(200);
    const where = prisma.commerce.findMany.mock.calls.at(-1)[0].where;
    expect(where.status).toBeUndefined();
  });

  it('detalle público oculta comercio PENDING', async () => {
    prisma.commerce.findUnique.mockResolvedValueOnce({
      id: 7,
      name: 'Secreto',
      status: 'PENDING',
      isActive: true,
      ownerId: 99,
      categories: [],
      branches: [],
      events: [],
      comments: [],
    });

    const res = await api.get('/api/commerces/7');
    expect(res.status).toBe(404);
  });

  it('ADMIN aprueba comercio y owner pasa a OWNER', async () => {
    const pending = {
      id: 7,
      name: 'Secreto',
      status: 'PENDING',
      ownerId: user.id,
      owner: { email: 'socio@test.com', name: 'Socio' },
    };
    prisma.commerce.findUnique.mockResolvedValue(pending);
    prisma.commerce.update.mockResolvedValue({
      ...pending,
      status: 'ACTIVE',
      owner: pending.owner,
    });
    prisma.user.update.mockResolvedValue({ id: user.id, role: 'OWNER' });

    const res = await api
      .put('/api/commerces/7/validate')
      .set(authHeader(admin))
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'OWNER' } })
    );
  });
});

describe('Eventos', () => {
  it('USER no puede crear eventos', async () => {
    const res = await api.post('/api/events').set(authHeader(user)).send({
      name: 'Fiesta',
      description: 'Noche',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      commerceId: 1,
    });
    expect(res.status).toBe(403);
  });

  it('OWNER crea evento en PENDING', async () => {
    prisma.commerce.findUnique.mockResolvedValueOnce({
      id: 1,
      ownerId: owner.id,
      status: 'ACTIVE',
    });
    prisma.event.create.mockResolvedValueOnce({
      id: 20,
      name: 'Peña',
      status: 'PENDING',
      commerceId: 1,
      isActive: true,
    });

    const res = await api.post('/api/events').set(authHeader(owner)).send({
      name: 'Peña',
      description: 'Folklore',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      commerceId: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    const createData = prisma.event.create.mock.calls.at(-1)[0].data;
    expect(createData.status).toBe('PENDING');
  });

  it('listado público solo pide SCHEDULED + isActive', async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    const res = await api.get('/api/events');
    expect(res.status).toBe(200);
    const where = prisma.event.findMany.mock.calls.at(-1)[0].where;
    expect(where.status).toBe('SCHEDULED');
    expect(where.isActive).toBe(true);
  });

  it('ADMIN aprueba evento a SCHEDULED', async () => {
    prisma.event.findUnique.mockResolvedValueOnce({ id: 20, status: 'PENDING' });
    prisma.event.update.mockResolvedValueOnce({
      id: 20,
      status: 'SCHEDULED',
      isActive: true,
    });

    const res = await api.patch('/api/events/20/approve').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SCHEDULED');
  });

  it('ADMIN valida pago de evento Plus/Premium', async () => {
    prisma.event.findUnique.mockResolvedValue({ id: 21, paymentStatus: 'PENDING', eventTier: 2 });
    prisma.event.update.mockResolvedValueOnce({
      id: 21,
      paymentStatus: 'VALIDATED',
    });

    const res = await api
      .patch('/api/events/21/validate-payment')
      .set(authHeader(admin))
      .send({ paymentStatus: 'VALIDATED' });

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe('VALIDATED');
  });
});

describe('Submissions y planes', () => {
  it('contacto anónimo crea submission PENDING', async () => {
    prisma.submission.create.mockResolvedValueOnce({
      id: 3,
      type: 'CONTACT',
      status: 'PENDING',
      message: 'Hola',
      name: 'Ana',
      userId: null,
    });

    const res = await api.post('/api/submissions').send({
      type: 'CONTACT',
      name: 'Ana',
      email: 'ana@test.com',
      message: 'Hola',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
  });

  it('aprobar PLAN_UPGRADE actualiza planLevel y usa Plan por level', async () => {
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 4,
      type: 'PLAN_UPGRADE',
      status: 'PENDING',
      userId: owner.id,
      message: 'Quiero pasar a nivel 3 oro',
      attachmentUrl: null,
      user: { email: 'dueno@test.com', name: 'Dueño' },
    });
    prisma.submission.update.mockResolvedValueOnce({
      id: 4,
      type: 'PLAN_UPGRADE',
      status: 'APPROVED',
      userId: owner.id,
      message: 'Quiero pasar a nivel 3 oro',
      attachmentUrl: null,
      user: { email: 'dueno@test.com', name: 'Dueño' },
    });
    prisma.commerce.findFirst.mockResolvedValueOnce({
      id: 11,
      ownerId: owner.id,
      planLevel: 1,
    });
    prisma.plan.findUnique.mockResolvedValueOnce({ id: 30, level: 3, name: 'Oro' });
    prisma.commerce.update.mockResolvedValueOnce({ id: 11, planLevel: 3 });
    prisma.planHistory.create.mockResolvedValueOnce({ id: 1 });

    const res = await api
      .patch('/api/submissions/4/reply')
      .set(authHeader(admin))
      .send({ status: 'APPROVED', adminResponse: 'Ok' });

    expect(res.status).toBe(200);
    expect(prisma.commerce.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planLevel: 3, planId: 30 }),
      })
    );
    expect(prisma.planHistory.create).toHaveBeenCalled();
  });
});

describe('Favoritos y validación', () => {
  it('sin token no puede toggle favorito', async () => {
    const res = await api.post('/api/favorites/toggle').send({
      resourceId: 1,
      resourceType: 'commerce',
    });
    expect(res.status).toBe(401);
  });

  it('USER A no ve favoritos de USER B', async () => {
    prisma.favorite.findMany.mockResolvedValueOnce([]);
    const res = await api.get('/api/favorites/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(prisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.id } })
    );
  });

  it('toggle crea y después borra el favorito', async () => {
    prisma.favorite.findUnique.mockResolvedValueOnce(null);
    prisma.favorite.create.mockResolvedValueOnce({ id: 1 });

    const first = await api
      .post('/api/favorites/toggle')
      .set(authHeader(user))
      .send({ resourceId: 9, resourceType: 'COMMERCE' });

    expect(first.status).toBe(200);
    expect(first.body.favorited).toBe(true);
    expect(first.body.resourceType).toBe('commerce');

    prisma.favorite.findUnique.mockResolvedValueOnce({ id: 1, userId: user.id });
    prisma.favorite.delete.mockResolvedValueOnce({ id: 1 });

    const second = await api
      .post('/api/favorites/toggle')
      .set(authHeader(user))
      .send({ resourceId: 9, resourceType: 'commerce' });

    expect(second.status).toBe(200);
    expect(second.body.favorited).toBe(false);
  });

  it('rechaza resourceType inválido', async () => {
    const res = await api
      .post('/api/favorites/toggle')
      .set(authHeader(user))
      .send({ resourceId: 1, resourceType: 'pizza' });
    expect(res.status).toBe(400);
  });

  it('ADMIN no puede validar comercio con isValidated viejo', async () => {
    const res = await api
      .put('/api/commerces/3/validate')
      .set(authHeader(admin))
      .send({ isValidated: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/status/i);
  });
});

describe('Admin AI Guard', () => {
  it('USER no entra a stats de moderación', async () => {
    const res = await api.get('/api/admin/moderation/stats').set(authHeader(user));
    expect(res.status).toBe(403);
  });

  it('ADMIN lee stats y chat', async () => {
    const stats = await api.get('/api/admin/moderation/stats').set(authHeader(admin));
    expect(stats.status).toBe(200);
    expect(stats.body.flagged).toBe(1);

    const chat = await api.post('/api/admin/ai/chat').set(authHeader(admin)).send({
      messages: [{ role: 'user', content: '¿Cómo valido un comercio PENDING?' }],
    });
    expect(chat.status).toBe(200);
    expect(chat.body.reply).toMatch(/Salta|fotos/i);
  });
});

describe('Asistente PANDORA', () => {
  it('POST /api/ai/assistant sin token responde 200', async () => {
    const res = await api.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: '¿Qué es PANDORA?' }],
      page: '/',
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/Salta|fotos/i);
    expect(Array.isArray(res.body.actions)).toBe(true);
  });

  it('lista comercios con acciones para abrir el catálogo', async () => {
    prisma.commerce.findMany.mockResolvedValueOnce([
      { id: 1, name: 'La Casona de Salta', category: 'GASTRONOMIA', shortDescription: 'Cocina regional', address: 'Caseros 100', coverImage: '/seed/casona.png' },
    ]);
    const res = await api.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Mostrame comercios' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('list_commerces');
    expect(res.body.items[0]).toMatchObject({
      label: 'La Casona de Salta',
      to: '/commerce/1',
      type: 'commerce',
      image: '/seed/casona.png',
    });
    expect(res.body.actions.some((action) => action.to === '/commerces')).toBe(true);
  });

  it('lista eventos con ficha clicable', async () => {
    prisma.event.findMany.mockResolvedValueOnce([
      {
        id: 9,
        name: 'Peña del viernes',
        startDate: '2026-08-21T21:00:00.000Z',
        address: 'Balcarce 50',
        coverImage: '/seed/pena.png',
        commerce: { name: 'La Casona de Salta' },
      },
    ]);
    const res = await api.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Mostrame eventos' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('list_events');
    expect(res.body.items[0]).toMatchObject({
      label: 'Peña del viernes',
      to: '/event/9',
      type: 'event',
    });
    expect(res.body.actions.some((action) => action.to === '/events')).toBe(true);
  });

  it('ofrece el alta de comercio si preguntan cómo cargar un local', async () => {
    const res = await api.post('/api/ai/assistant').set(authHeader(user)).send({
      messages: [{ role: 'user', content: 'Quiero cargar mi local' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('create_commerce');
    expect(res.body.actions.some((action) => action.to === '/commerces/create')).toBe(true);
  });

  it('rechaza messages vacío', async () => {
    const res = await api.post('/api/ai/assistant').send({ messages: [] });
    expect(res.status).toBe(400);
  });

  it('USER no usa la ruta admin de Guard', async () => {
    const res = await api.post('/api/admin/ai/chat').set(authHeader(user)).send({
      messages: [{ role: 'user', content: 'hola' }],
    });
    expect(res.status).toBe(403);
  });

  it('no expone el error crudo de Groq al visitante', async () => {
    const groqDump = '404 {"error":{"message":"The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}';
    chatCompletion.mockRejectedValueOnce(Object.assign(new Error(groqDump), { status: 404 }));

    const res = await api.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'hola' }],
    });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/asistente no está disponible/i);
    expect(res.body.message).not.toMatch(/llama|model_not_found|invalid_request/i);
  });

  it('rate limita al asistente anónimo', async () => {
    process.env.TEST_ASSISTANT_LIMIT = '1';
    try {
      const first = await api.post('/api/ai/assistant').send({
        messages: [{ role: 'user', content: 'hola' }],
      });
      expect(first.status).toBe(200);
      const second = await api.post('/api/ai/assistant').send({
        messages: [{ role: 'user', content: 'otra' }],
      });
      expect(second.status).toBe(429);
    } finally {
      delete process.env.TEST_ASSISTANT_LIMIT;
    }
  });
});
