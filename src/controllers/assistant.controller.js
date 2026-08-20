import prisma from '../db/prismaClient.js';
import { chatCompletion, stripThinking } from '../services/ai.service.js';
import { toPublicAiError } from '../utils/ai-errors.js';
import {
  actionsFor,
  detectIntent,
  humanizeLabel,
  itemsFor,
  processHint,
} from '../services/assistant.guide.js';

function rolePrompt(role) {
  if (role === 'ADMIN') {
    return 'Rol: ADMIN. Guiarlo a validar colas. El AI Guard lista interceptaciones; no bloquea altas.';
  }
  if (role === 'OWNER') {
    return 'Rol: OWNER. Planes, eventos PENDING, responder comentarios, editar ficha.';
  }
  if (role === 'USER') {
    return 'Rol: USER. Favoritos, comentar, contactar, alta de comercio (queda PENDING).';
  }
  return 'Rol: visitante. Puede explorar sin cuenta. Para favoritos, comentar o publicar un local, tiene que registrarse o entrar.';
}

function formatWhen(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadCatalog() {
  try {
    const [commerces, events, articles] = await Promise.all([
      prisma.commerce.findMany({
        where: { status: 'ACTIVE', isActive: true },
        select: {
          id: true,
          name: true,
          category: true,
          shortDescription: true,
          address: true,
          coverImage: true,
          isFeatured: true,
        },
        take: 12,
        orderBy: [{ isFeatured: 'desc' }, { planLevel: 'desc' }, { name: 'asc' }],
      }),
      prisma.event.findMany({
        where: { status: 'SCHEDULED', isActive: true },
        select: {
          id: true,
          name: true,
          startDate: true,
          address: true,
          coverImage: true,
          commerce: { select: { name: true } },
        },
        take: 10,
        orderBy: [{ featured: 'desc' }, { startDate: 'asc' }],
      }),
      prisma.article.findMany({
        where: { status: 'PUBLISHED', isActive: true },
        select: {
          title: true,
          slug: true,
          subtitle: true,
          coverImage: true,
          category: { select: { name: true } },
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      commerces: commerces.map((item) => ({
        id: `commerce-${item.id}`,
        type: 'commerce',
        label: item.name,
        hint: humanizeLabel(item.category, 'Comercio'),
        meta: item.address || item.shortDescription || '',
        image: item.coverImage || null,
        category: item.category,
        searchText: [item.name, item.shortDescription, item.address, item.category].filter(Boolean).join(' '),
        to: `/commerce/${item.id}`,
      })),
      events: events.map((item) => ({
        id: `event-${item.id}`,
        type: 'event',
        label: item.name,
        hint: formatWhen(item.startDate) || 'Evento',
        meta: item.commerce?.name || item.address || 'Agenda PANDORA',
        image: item.coverImage || null,
        searchText: [item.name, item.address, item.commerce?.name].filter(Boolean).join(' '),
        to: `/event/${item.id}`,
      })),
      articles: articles.map((item) => ({
        id: `article-${item.slug}`,
        type: 'article',
        label: item.title,
        hint: item.category?.name || 'Revista',
        meta: item.subtitle || 'Nota de magazine',
        image: item.coverImage || null,
        searchText: [item.title, item.subtitle, item.category?.name].filter(Boolean).join(' '),
        to: `/article/${item.slug}`,
      })),
    };
  } catch {
    return { commerces: [], events: [], articles: [] };
  }
}

function softenReply(text) {
  return stripThinking(String(text || ''))
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const postAssistantChat = async (req, res) => {
  try {
    const { messages, page } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Enviá un array messages con al menos un mensaje' });
    }

    const role = req.user?.role || 'GUEST';
    const lastUser = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
    const intent = detectIntent(lastUser);
    const catalog = await loadCatalog();
    const items = itemsFor(intent, catalog, lastUser);
    const actions = actionsFor(intent, role);

    const systemPrompt = `Sos el asistente de PANDORA, guía de descubrimiento local de Salta (Argentina). No es un e-commerce: no hay carrito ni pedidos.

Cómo hablar:
- Español rioplatense (vos). Cálido y concreto.
- 2 a 5 frases. Si es un trámite, hasta 4 pasos cortos (una línea cada uno).
- Sin markdown: nada de ** ni #.
- Si hay tarjetas abajo, no copies la lista: presentá en 1 o 2 frases y decí que toque una ficha para ver el detalle.
- No inventes fichas. Si no hay tarjetas, no enumeres locales de memoria.
- Un trámite por mensaje. No mezcles registro, planes y magazine si no preguntaron eso.
- Nunca escribas etiquetas think ni tu razonamiento interno. Solo el texto para la persona.

${rolePrompt(role)}
Intención detectada: ${intent}.
Cómo ayudar en este trámite: ${processHint(intent, role)}
Página actual: ${page || '/'}.
Nombres de muestra (no inventes otros): ${[
      ...catalog.commerces.map((item) => item.label),
      ...catalog.events.map((item) => item.label),
      ...catalog.articles.map((item) => item.label),
    ].join(', ') || 'ninguno en esta base'}.`;

    const reply = softenReply(await chatCompletion(messages, { systemPrompt }));
    res.status(200).json({ reply, intent, actions, items });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error('[ASSISTANT]', error.message);
    const publicError = toPublicAiError(error);
    res.status(publicError.statusCode).json({ message: publicError.message });
  }
};
