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

async function loadCatalog(query = '') {
  const q = String(query || '').trim().slice(0, 60);
  // Ignorar palabras de intención ("mostrame", "comercios", etc.) para no achicar el catálogo
  const INTENT_NOISE = new Set([
    'me', 'mi', 'mis', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'en', 'por', 'para', 'con', 'y', 'o', 'a',
    'que', 'que', 'hay', 'hoy', 'ahora', 'algo', 'mostrar', 'mostrame', 'mostra', 'lista', 'listame', 'ver', 'dame',
    'quiero', 'busca', 'buscame', 'recomendame', 'recomenda', 'lugares', 'lugar', 'sitios', 'sitio', 'pandora', 'salta',
    'comercio', 'comercios', 'local', 'locales', 'evento', 'eventos', 'agenda', 'revista', 'articulo', 'articulos',
    'noticia', 'notas', 'magazine', 'resto', 'bar', 'cafe', 'cafeteria', 'opciones', 'algunos', 'algunas',
  ]);
  const tokens = q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !INTENT_NOISE.has(t))
    .slice(0, 4);

  const useSearch = tokens.length > 0;

  const commerceSearch = useSearch
    ? {
        OR: tokens.flatMap((token) => [
          { name: { contains: token } },
          { shortDescription: { contains: token } },
          { address: { contains: token } },
          { description: { contains: token } },
        ]),
      }
    : {};

  const eventSearch = useSearch
    ? {
        OR: tokens.flatMap((token) => [
          { name: { contains: token } },
          { address: { contains: token } },
          { description: { contains: token } },
        ]),
      }
    : {};

  const articleSearch = useSearch
    ? {
        OR: tokens.flatMap((token) => [
          { title: { contains: token } },
          { subtitle: { contains: token } },
        ]),
      }
    : {};

  try {
    const [commerces, events, articles, baseCommerces, baseEvents, baseArticles] = await Promise.all([
      prisma.commerce.findMany({
        where: { status: 'ACTIVE', isActive: true, ...commerceSearch },
        select: {
          id: true,
          name: true,
          category: true,
          shortDescription: true,
          address: true,
          coverImage: true,
          isFeatured: true,
        },
        take: useSearch ? 24 : 20,
        orderBy: [{ isFeatured: 'desc' }, { planLevel: 'desc' }, { name: 'asc' }],
      }),
      prisma.event.findMany({
        where: { status: 'SCHEDULED', isActive: true, ...eventSearch },
        select: {
          id: true,
          name: true,
          startDate: true,
          address: true,
          coverImage: true,
          commerce: { select: { name: true } },
        },
        take: useSearch ? 16 : 12,
        orderBy: [{ featured: 'desc' }, { startDate: 'asc' }],
      }),
      prisma.article.findMany({
        where: { status: 'PUBLISHED', isActive: true, ...articleSearch },
        select: {
          title: true,
          slug: true,
          subtitle: true,
          coverImage: true,
          category: { select: { name: true } },
        },
        take: useSearch ? 12 : 10,
        orderBy: { createdAt: 'desc' },
      }),
      // Catálogo base amplio para listados (aunque la búsqueda puntual venga vacía)
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
        take: 20,
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
        take: 12,
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
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mergeById = (primary, secondary) => {
      const map = new Map();
      [...primary, ...secondary].forEach((item) => map.set(item.id ?? item.slug, item));
      return [...map.values()];
    };

    const mergedCommerces = mergeById(commerces, baseCommerces);
    const mergedEvents = mergeById(events, baseEvents);
    const mergedArticles = mergeById(articles, baseArticles);

    return {
      commerces: mergedCommerces.map((item) => ({
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
      events: mergedEvents.map((item) => ({
        id: `event-${item.id}`,
        type: 'event',
        label: item.name,
        hint: formatWhen(item.startDate) || 'Evento',
        meta: item.commerce?.name || item.address || 'Agenda PANDORA',
        image: item.coverImage || null,
        searchText: [item.name, item.address, item.commerce?.name].filter(Boolean).join(' '),
        to: `/event/${item.id}`,
      })),
      articles: mergedArticles.map((item) => ({
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
    const catalog = await loadCatalog(lastUser);
    const items = itemsFor(intent, catalog, lastUser);
    const actions = actionsFor(intent, role);

    const systemPrompt = `Sos el asistente de PANDORA, guía de descubrimiento local de Salta (Argentina). No es un e-commerce: no hay carrito ni pedidos.

Cómo hablar:
- Español rioplatense (vos). Cálido, claro y útil.
- Respondé SIEMPRE a lo que preguntó la persona. Si es un cómo-hacer, dale pasos. Si busca un lugar o plan, usá las fichas reales.
- 2 a 6 frases (o hasta 5 pasos cortos si es un trámite). Sin markdown: nada de ** ni #.
- Si hay tarjetas abajo, no copies la lista entera: presentá en 1 o 2 frases y decí que toque una ficha o “Ver todos”.
- No inventes fichas ni nombres que no estén en “Nombres de muestra”. Si no hay match, decilo y ofrecé explorar comercios/eventos/revista.
- Podés explicar registro, login, favoritos, comentarios, planes, contacto, alta de comercio/evento y paneles según el rol.
- Nunca escribas etiquetas think ni tu razonamiento interno. Solo el texto para la persona.

${rolePrompt(role)}
Intención detectada: ${intent}.
Cómo ayudar en este trámite: ${processHint(intent, role)}
Página actual: ${page || '/'}.
Pregunta del usuario: ${lastUser || '(vacía)'}.
Cantidad de fichas adjuntas: ${items.length}.
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
