import prisma from '../db/prismaClient.js';
import { classifyContent, analyzeImages, isAiConfigured } from './ai.service.js';

/**
 * PANDORA AI GUARD — interceptor
 * 1. Filtro básico (léxico / patrones)
 * 2. Groq texto (si hay GROQ_API_KEY)
 * 3. Groq visión sobre fotos (opcional)
 *
 * Nunca bloquea el alta ni la edición. Siempre registra el caso.
 * APPROVED → log informativo
 * FLAGGED / REJECTED → queda en la cola del admin para decidir
 */

const WORD_RULES = [
  { category: 'estafa', severity: 'high', words: ['scam', 'fraude', 'estafa', 'phishing', 'duplicamos tu plata', 'duplicar dinero', 'inversion garantizada', 'hazte rico'] },
  { category: 'spam', severity: 'medium', words: ['spam', 'compra ya', 'oferta unica', 'oferta única', 'solo hoy click'] },
  { category: 'drogas', severity: 'high', words: ['drogas', 'cocaina', 'cocaína', 'marihuana venta', 'vender droga'] },
  { category: 'armas', severity: 'high', words: ['armas', 'vender pistola', 'vender arma'] },
  { category: 'sexual', severity: 'high', words: ['prostitucion', 'prostitución', 'pornografia', 'pornografía', 'porno', 'xxx', 'onlyfans', 'sexo oral', 'contenido sexual', 'desnudo explicito', 'desnudo explícito', 'nudes', 'pack hot'] },
  { category: 'insultos', severity: 'medium', words: ['hijo de puta', 'la concha de', 'boludo de mierda', 'pelotudo de mierda', 'idiota de mierda', 'forro de mierda', 'puto de mierda', 'mogolico', 'mogólico'] },
  { category: 'violencia', severity: 'high', words: ['matar a', 'te voy a matar', 'violencia grafica', 'violencia gráfica'] },
  { category: 'ilegal', severity: 'high', words: ['ilegal', 'documento falso', 'dni falso'] },
];

const PATTERN_RULES = [
  {
    category: 'datos_sensibles',
    severity: 'high',
    regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    reason: 'Posible número de tarjeta o dato sensible',
  },
  {
    category: 'estafa',
    severity: 'high',
    regex: /(bitcoin|btc|crypto|ethereum|eth)\s*(wallet|address|enviar|transferir|billetera)/gi,
    reason: 'Patrón típico de estafa cripto / transferencia',
  },
  {
    category: 'spam',
    severity: 'medium',
    regex: /(https?:\/\/[^\s]+){3,}/gi,
    reason: 'Demasiados enlaces seguidos (spam)',
  },
  {
    category: 'spam',
    severity: 'medium',
    regex: /([A-ZÁÉÍÓÚÑ]{8,}\s*){3,}/g,
    reason: 'Texto en mayúsculas agresivas (spam)',
  },
];

export const GUARD_EXAMPLES = [
  {
    category: 'insultos',
    title: 'Lenguaje ofensivo',
    input: 'Sos un idiota, no vengan a este lugar',
    step: 'Filtro local + texto IA',
    why: 'Contiene insultos dirigidos a personas',
    result: 'FLAGGED',
    resultLabel: 'Marcar → Por revisar',
  },
  {
    category: 'estafa',
    title: 'Estafa / phishing',
    input: 'Transferí a esta billetera y duplicamos tu plata',
    step: 'Filtro local + texto IA',
    why: 'Promesa engañosa de dinero y transferencia',
    result: 'REJECTED',
    resultLabel: 'Alerta alta',
  },
  {
    category: 'sexual',
    title: 'Contenido sexual en texto',
    input: 'Local con shows sexuales explícitos y packs privados',
    step: 'Filtro local + texto IA',
    why: 'Lenguaje sexual explícito no apto para la guía local',
    result: 'REJECTED',
    resultLabel: 'Alerta alta',
  },
  {
    category: 'imagenes',
    title: 'Imágenes',
    input: 'Foto de un plato de empanadas vs imagen sexual / nudez',
    step: 'Análisis de imágenes',
    why: 'Comida y locales se aprueban; nudez o sexual explícito se marca',
    result: 'APPROVED_OR_REJECTED',
    resultLabel: 'Comida OK / sexual → alerta',
  },
  {
    category: 'spam',
    title: 'Spam de enlaces',
    input: 'COMPRÁ YA http://a.com http://b.com http://c.com',
    step: 'Filtro local',
    why: 'Muchos links y mayúsculas agresivas',
    result: 'FLAGGED',
    resultLabel: 'Marcar',
  },
  {
    category: 'datos_sensibles',
    title: 'Datos sensibles',
    input: 'Pagar con 4111 1111 1111 1111',
    step: 'Filtro local',
    why: 'Parece número de tarjeta',
    result: 'FLAGGED',
    resultLabel: 'Marcar / alerta',
  },
  {
    category: 'valido',
    title: 'Contenido válido',
    input: 'Peña en La Casona, sábado 22 hs. Folklore en vivo.',
    step: 'Filtro + texto (+ fotos si hay)',
    why: 'Agenda cultural normal de Salta',
    result: 'APPROVED',
    resultLabel: 'En orden',
  },
];

function checkBasicFilters(text) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const matches = [];
  const categories = new Set();
  let severity = 'low';

  for (const rule of WORD_RULES) {
    for (const word of rule.words) {
      if (lower.includes(word.toLowerCase())) {
        matches.push(word);
        categories.add(rule.category);
        if (rule.severity === 'high') severity = 'high';
        else if (severity !== 'high' && rule.severity === 'medium') severity = 'medium';
      }
    }
  }

  for (const rule of PATTERN_RULES) {
    const clone = new RegExp(rule.regex.source, rule.regex.flags);
    if (clone.test(raw)) {
      matches.push(rule.reason);
      categories.add(rule.category);
      if (rule.severity === 'high') severity = 'high';
      else if (severity !== 'high' && rule.severity === 'medium') severity = 'medium';
    }
  }

  const hit = matches.length > 0;
  const categoryList = [...categories];
  return {
    hit,
    blocked: hit,
    categories: categoryList,
    matches: [...new Set(matches)].slice(0, 12),
    severity: hit ? severity : null,
    reason: hit
      ? `Filtro local: posible ${categoryList.join(', ')}`
      : null,
    details: hit ? matches[0] : null,
  };
}

export function collectImageUrls(data = {}) {
  const urls = [];
  if (data.coverImage) urls.push(data.coverImage);
  if (data.imageUrl) urls.push(data.imageUrl);
  if (Array.isArray(data.galleryImages)) urls.push(...data.galleryImages);
  return [...new Set(urls.filter((url) => typeof url === 'string' && url.trim()))].slice(0, 5);
}

export function buildCommerceModerationText(data = {}) {
  return [
    data.name,
    data.shortDescription,
    data.description,
    data.address,
    data.phone,
    data.whatsapp,
    data.website,
    data.facebook,
    data.instagram,
    data.externalLink,
  ].filter(Boolean).join('\n');
}

export function moderationFieldsChanged(before = {}, after = {}, fields = []) {
  return fields.some((field) => {
    const prev = before?.[field];
    const next = after?.[field];
    return JSON.stringify(prev ?? null) !== JSON.stringify(next ?? null);
  });
}

function worseStatus(a, b) {
  const rank = { APPROVED: 0, FLAGGED: 1, REJECTED: 2 };
  return (rank[b] || 0) > (rank[a] || 0) ? b : a;
}

function statusFromBasic(basic) {
  if (!basic?.hit) return 'APPROVED';
  return basic.severity === 'high' ? 'REJECTED' : 'FLAGGED';
}

async function createModerationLog(data) {
  try {
    return await prisma.moderationLog.create({
      data: {
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        status: data.status,
        analyzedText: data.analyzedText,
        basicFilterResult: data.basicFilterResult,
        aiResult: data.aiResult
      }
    });
  } catch (error) {
    console.error('[MODERACIÓN] Error creando log:', error.message);
    return null;
  }
}

function interceptResult(log, status, reason) {
  const needsReview = status === 'FLAGGED' || status === 'REJECTED';
  return {
    approved: true,
    requiresReview: needsReview,
    status,
    reason: reason || (needsReview ? 'Marcado para revisión del admin' : ''),
    logId: log?.id,
  };
}

/**
 * Intercepta contenido: siempre deja seguir el alta/edición y deja rastro para el admin.
 * @returns {Promise<{approved: boolean, requiresReview: boolean, reason?: string, logId?: number, status: string}>}
 */
export const moderateContent = async (
  text,
  resourceType,
  resourceId = null,
  imageUrls = [],
  options = {}
) => {
  const fieldsAnalyzed = options.fieldsAnalyzed || ['contenido'];
  const basicResult = checkBasicFilters(text);
  const pipeline = ['basic'];

  const aiText = await classifyContent(text);
  if (!aiText.skipped) pipeline.push('text');

  const aiVision = imageUrls.length
    ? await analyzeImages(imageUrls)
    : { skipped: true, reason: 'Sin imágenes para revisar' };
  if (!aiVision.skipped) pipeline.push('vision');

  let status = 'APPROVED';
  const reasons = [];

  if (basicResult.hit) {
    status = worseStatus(status, statusFromBasic(basicResult));
    reasons.push(basicResult.reason);
  }

  if (!aiText.skipped && aiText.status) {
    status = worseStatus(status, aiText.status);
    if (aiText.status !== 'APPROVED' && aiText.reason) reasons.push(aiText.reason);
  }

  if (!aiVision.skipped && aiVision.status) {
    status = worseStatus(status, aiVision.status);
    if (aiVision.status !== 'APPROVED' && aiVision.reason) reasons.push(aiVision.reason);
  }

  if (basicResult.hit && aiText.skipped && (aiVision.skipped || !imageUrls.length)) {
    status = worseStatus(status, statusFromBasic(basicResult));
  }

  const categories = [
    ...(basicResult.categories || []),
    ...(aiText.categories || []),
    ...(aiVision.categories || []),
  ];

  const aiResult = {
    pipeline,
    basic: basicResult,
    text: aiText.skipped ? { skipped: true, reason: aiText.reason || aiText.message || 'Omitido' } : aiText,
    vision: aiVision.skipped
      ? { skipped: true, reason: aiVision.reason || aiVision.message || 'Omitido', imagesChecked: 0 }
      : { ...aiVision, imagesChecked: Math.min(imageUrls.length, 5) },
    finalStatus: status,
    categories: [...new Set(categories)],
    fieldsAnalyzed,
    groqConfigured: isAiConfigured(),
    reason: reasons.filter(Boolean).join(' | '),
  };

  const log = await createModerationLog({
    resourceType,
    resourceId,
    status,
    analyzedText: String(text || '').slice(0, 15000),
    basicFilterResult: basicResult,
    aiResult,
  });

  return interceptResult(log, status, reasons.filter(Boolean).join(' | '));
};

export const attachModerationResource = async (logId, resourceId) => {
  if (!logId || !resourceId) return;
  try {
    await prisma.moderationLog.update({
      where: { id: logId },
      data: { resourceId: Number(resourceId) }
    });
  } catch (error) {
    console.error('[MODERACIÓN] No se pudo asociar resourceId:', error.message);
  }
};

const uniqueIds = (ids) => [...new Set(ids.filter((id) => Number.isInteger(id)))];

function extractReason(log) {
  const basic = log.basicFilterResult || {};
  if (basic.hit || basic.blocked) {
    return basic.reason || `Filtro básico: ${basic.details || 'patrón sospechoso'}`;
  }
  const ai = log.aiResult || {};
  return ai.reason || ai.text?.reason || ai.vision?.reason || '';
}

function excerpt(text, max = 140) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Sin texto';
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function exampleHint(log) {
  const cats = [
    ...(log.basicFilterResult?.categories || []),
    ...(log.aiResult?.categories || []),
  ];
  const first = cats[0];
  if (!first) return null;
  return GUARD_EXAMPLES.find((ex) => ex.category === first) || null;
}

async function hydrateLogs(logs) {
  const commerceIds = uniqueIds(logs.filter((l) => l.resourceType === 'COMMERCE').map((l) => l.resourceId));
  const eventIds = uniqueIds(logs.filter((l) => l.resourceType === 'EVENT').map((l) => l.resourceId));
  const articleIds = uniqueIds(logs.filter((l) => l.resourceType === 'ARTICLE').map((l) => l.resourceId));
  const commentIds = uniqueIds(logs.filter((l) => l.resourceType === 'COMMENT').map((l) => l.resourceId));
  const submissionIds = uniqueIds(logs.filter((l) => l.resourceType === 'SUBMISSION').map((l) => l.resourceId));

  const [commerces, events, articles, comments, submissions] = await Promise.all([
    commerceIds.length ? prisma.commerce.findMany({
      where: { id: { in: commerceIds } },
      select: { id: true, name: true, category: true, status: true, address: true }
    }) : [],
    eventIds.length ? prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, name: true, status: true, address: true }
    }) : [],
    articleIds.length ? prisma.article.findMany({
      where: { id: { in: articleIds } },
      select: { id: true, title: true, slug: true, status: true }
    }) : [],
    commentIds.length ? prisma.commerceComment.findMany({
      where: { id: { in: commentIds } },
      select: { id: true, comment: true, commerceId: true, userName: true, commerce: { select: { name: true } } }
    }) : [],
    submissionIds.length ? prisma.submission.findMany({
      where: { id: { in: submissionIds } },
      select: { id: true, type: true, message: true, name: true, email: true, status: true }
    }) : [],
  ]);

  const commerceMap = Object.fromEntries(commerces.map((c) => [c.id, c]));
  const eventMap = Object.fromEntries(events.map((e) => [e.id, e]));
  const articleMap = Object.fromEntries(articles.map((a) => [a.id, a]));
  const commentMap = Object.fromEntries(comments.map((c) => [c.id, c]));
  const submissionMap = Object.fromEntries(submissions.map((s) => [s.id, s]));

  return logs.map((log) => {
    let resource = null;
    if (log.resourceType === 'COMMERCE' && commerceMap[log.resourceId]) {
      const c = commerceMap[log.resourceId];
      resource = {
        title: c.name,
        subtitle: c.address || '',
        status: c.status,
        category: c.category,
        href: `/admin/commerces/${c.id}/detail`,
        publicHref: `/commerce/${c.id}`,
      };
    } else if (log.resourceType === 'EVENT' && eventMap[log.resourceId]) {
      const e = eventMap[log.resourceId];
      resource = {
        title: e.name,
        subtitle: e.address || '',
        status: e.status,
        href: '/admin/events',
        publicHref: `/event/${e.id}`,
      };
    } else if (log.resourceType === 'ARTICLE' && articleMap[log.resourceId]) {
      const a = articleMap[log.resourceId];
      resource = {
        title: a.title,
        subtitle: a.slug || '',
        status: a.status,
        href: `/admin/articles/edit/${a.id}`,
        publicHref: a.slug ? `/article/${a.slug}` : null,
      };
    } else if (log.resourceType === 'COMMENT' && commentMap[log.resourceId]) {
      const c = commentMap[log.resourceId];
      resource = {
        title: c.commerce?.name ? `Comentario en ${c.commerce.name}` : 'Comentario',
        subtitle: c.userName || 'Anónimo',
        href: c.commerceId ? `/admin/commerces/${c.commerceId}/detail` : '/admin/dashboard',
        publicHref: c.commerceId ? `/commerce/${c.commerceId}` : null,
      };
    } else if (log.resourceType === 'SUBMISSION' && submissionMap[log.resourceId]) {
      const s = submissionMap[log.resourceId];
      resource = {
        title: s.name ? `Buzón: ${s.name}` : 'Mensaje del buzón',
        subtitle: s.email || s.type || '',
        status: s.status,
        href: '/admin/submissions',
        publicHref: null,
      };
    }

    const reason = extractReason(log);
    const similarExample = exampleHint(log);
    return {
      ...log,
      title: resource?.title || excerpt(log.analyzedText, 80),
      summary: excerpt(log.analyzedText),
      reason,
      resource,
      similarExample,
      needsReview: !log.reviewedAt && (log.status === 'FLAGGED' || log.status === 'REJECTED'),
    };
  });
}

const pendingWhere = {
  reviewedAt: null,
  status: { in: ['FLAGGED', 'REJECTED'] },
};

export const getFlaggedContent = async () => {
  const logs = await prisma.moderationLog.findMany({
    where: pendingWhere,
    include: { reviewer: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 80
  });
  return hydrateLogs(logs);
};

export const getModerationLogs = async (filter = 'pending') => {
  const where = {
    pending: pendingWhere,
    reviewed: { reviewedAt: { not: null } },
    flagged: { status: 'FLAGGED' },
    approved: { status: 'APPROVED' },
    rejected: { status: 'REJECTED' },
    all: {},
  }[filter] || pendingWhere;

  const logs = await prisma.moderationLog.findMany({
    where,
    include: { reviewer: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  return hydrateLogs(logs);
};

export const getModerationStats = async () => {
  const [total, approved, flagged, rejected, pendingReview] = await Promise.all([
    prisma.moderationLog.count(),
    prisma.moderationLog.count({ where: { status: 'APPROVED' } }),
    prisma.moderationLog.count({ where: { status: 'FLAGGED' } }),
    prisma.moderationLog.count({ where: { status: 'REJECTED' } }),
    prisma.moderationLog.count({ where: pendingWhere })
  ]);

  return {
    total,
    approved,
    flagged,
    rejected,
    pendingReview,
    approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : 0,
    ai: { configured: isAiConfigured() },
    examples: GUARD_EXAMPLES,
  };
};

export const reviewFlaggedLog = async (id, adminId, action, adminNotes) => {
  const log = await prisma.moderationLog.findUnique({ where: { id: parseInt(id) } });
  if (!log) {
    const error = new Error('Registro de moderación no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const nextStatus = action === 'reject' ? 'REJECTED' : 'APPROVED';
  return prisma.moderationLog.update({
    where: { id: log.id },
    data: {
      status: nextStatus,
      adminNotes: adminNotes || null,
      reviewedBy: adminId,
      reviewedAt: new Date()
    }
  });
};
