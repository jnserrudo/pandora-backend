import prisma from '../db/prismaClient.js';

/**
 * PANDORA AI GUARD - Sistema de Moderación Inteligente
 * 
 * Flujo de trabajo:
 * 1. Nivel 1 (Filtro Básico): Palabras prohibidas y patrones sospechosos
 * 2. Nivel 2 (OpenAI - OPCIONAL): Análisis profesional si API key está configurada
 * 3. Resultado:
 *    - REJECTED: Contenido peligroso, rechazado inmediatamente
 *    - FLAGGED: Contenido sospechoso, marcado para revisión extra del admin
 *    - APPROVED: Contenido seguro, continúa flujo normal (ej: PENDING para comercios)
 */

// ==================== NIVEL 1: FILTRO BÁSICO ====================

const bannedWords = [
  'scam', 'fraude', 'estafa', 'spam', 'phishing',
  'drogas', 'armas', 'prostitución', 'ilegal'
  // NOTA: Ampliar esta lista según necesidades
];

const suspiciousPatterns = [
  // Tarjetas de crédito
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  // Criptomonedas
  /(bitcoin|btc|crypto|ethereum|eth)\s*(wallet|address|enviar|transferir)/gi,
  // URLs sospechosas repetitivas
  /(https?:\/\/[^\s]+){3,}/gi,
  // Texto en mayúsculas excesivo (spam)
  /([A-ZÁÉÍÓÚÑ]{10,}\s*){3,}/g
];

/**
 * Nivel 1: Análisis básico sin dependencias externas
 */
function checkBasicFilters(text) {
  const lower = text.toLowerCase();
  
  // 1. Palabras prohibidas
  for (const word of bannedWords) {
    if (lower.includes(word)) {
      return { 
        blocked: true, 
        reason: `Contenido inapropiado detectado (palabra prohibida)`,
        details: word 
      };
    }
  }
  
  // 2. Patrones sospechosos
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return { 
        blocked: true, 
        reason: 'Patrón de contenido sospechoso detectado',
        details: 'Posible contenido de spam o malicioso' 
      };
    }
  }
  
  return { blocked: false, reason: null };
}

// ==================== NIVEL 2: OPENAI MODERATION (OPCIONAL) ====================

let openai = null;

// Inicializar OpenAI solo si hay API key
try {
  if (process.env.OPENAI_API_KEY) {
    const { default: OpenAI } = await import('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ AI Guard: OpenAI Moderation habilitada');
  } else {
    console.log('⚠️  AI Guard: Solo filtro básico (OPENAI_API_KEY no configurada)');
  }
} catch (error) {
  console.warn('⚠️  AI Guard: Error inicializando OpenAI, usando solo filtro básico:', error.message);
}

/**
 * Nivel 2: Análisis con IA profesional de OpenAI
 */
async function checkOpenAIModeration(text) {
  if (!openai) {
    return { skipped: true, reason: 'OpenAI no configurada' };
  }

  try {
    const response = await openai.moderations.create({
      input: text
    });

    const result = response.results[0];
    
    return {
      flagged: result.flagged,
      categories: result.categories,
      categoryScores: result.category_scores
    };
    
  } catch (error) {
    console.error('Error en OpenAI Moderation:', error);
    return { 
      error: true, 
      message: error.message,
      skipped: true 
    };
  }
}

// ==================== FUNCIÓN PRINCIPAL ====================

/**
 * Analiza contenido con AI Guard antes de permitir su creación/publicación
 * 
 * @param {string} text - Texto a analizar (título + descripción combinados)
 * @param {string} resourceType - Tipo: 'ARTICLE', 'COMMERCE', 'EVENT'
 * @param {number|null} resourceId - ID del recurso (null si aún no se creó)
 * @returns {Promise<{approved: boolean, requiresReview: boolean, reason?: string}>}
 */
export const moderateContent = async (text, resourceType, resourceId = null) => {
  // Nivel 1: Filtro básico
  const basicResult = checkBasicFilters(text);
  
  if (basicResult.blocked) {
    // RECHAZADO: Contenido peligroso detectado por filtro básico
    await createModerationLog({
      resourceType,
      resourceId,
      status: 'REJECTED',
      analyzedText: text,
      basicFilterResult: basicResult,
      aiResult: null
    });
    
    return {
      approved: false,
      requiresReview: false,
      reason: basicResult.reason
    };
  }

  // Nivel 2: OpenAI Moderation (si está disponible)
  const aiResult = await checkOpenAIModeration(text);
  
  if (aiResult.flagged) {
    // FLAGUEADO: Contenido sospechoso según IA
    await createModerationLog({
      resourceType,
      resourceId,
      status: 'FLAGGED',
      analyzedText: text,
      basicFilterResult: basicResult,
      aiResult
    });
    
    // Categorías específicas que son automáticamente rechazadas
    const autoBanCategories = ['sexual/minors', 'violence/graphic'];
    const hasAutoBan = Object.entries(aiResult.categories || {})
      .some(([cat, flagged]) => flagged && autoBanCategories.includes(cat));
    
    if (hasAutoBan) {
      return {
        approved: false,
        requiresReview: false,
        reason: 'Contenido inapropiado detectado por sistema de IA'
      };
    }
    
    // Resto de categorías: permitir pero marcar para revisión
    return {
      approved: true,
      requiresReview: true, // El admin verá esto marcado en rojo
      flaggedCategories: Object.entries(aiResult.categories)
        .filter(([_, flagged]) => flagged)
        .map(([cat]) => cat)
    };
  }

  // APROBADO: Contenido seguro
  await createModerationLog({
    resourceType,
    resourceId,
    status: 'APPROVED',
    analyzedText: text,
    basicFilterResult: basicResult,
    aiResult: aiResult.skipped ? null : aiResult
  });

  return {
    approved: true,
    requiresReview: false
  };
};

/**
 * Crea un registro de moderación en la BD
 */
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
    console.error('Error creando log de moderación:', error);
    // No lanzamos error para no interrumpir el flujo principal
  }
}

// ==================== ENDPOINTS PARA ADMINS ====================

/**
 * Obtiene contenido flagueado para revisión
 */
export const getFlaggedContent = async () => {
  return await prisma.moderationLog.findMany({
    where: { status: 'FLAGGED' },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
};

/**
 * Obtiene estadísticas de moderación
 */
export const getModerationStats = async () => {
  const [total, approved, flagged, rejected] = await Promise.all([
    prisma.moderationLog.count(),
    prisma.moderationLog.count({ where: { status: 'APPROVED' } }),
    prisma.moderationLog.count({ where: { status: 'FLAGGED' } }),
    prisma.moderationLog.count({ where: { status: 'REJECTED' } })
  ]);

  return {
    total,
    approved,
    flagged,
    rejected,
    approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : 0
  };
};
