const INTENTS = [
  { id: 'create_commerce', test: /carg(ar|o)|alta de|sumar mi|publicar.*(local|comer)|mi local|mi comercio|dar de alta/i },
  { id: 'create_event', test: /(crear|cargar|solicitar|publicar).*(evento)|evento.*(crear|cargar|solicitar)/i },
  { id: 'favorite', test: /favorit|guardar.*local|coraz[oó]n/i },
  { id: 'comment', test: /coment|opini[oó]n|rese[nñ]a|puntuar|calificar/i },
  { id: 'register', test: /registr|crear cuenta|sign ?up|hacer(me)? socio|nueva cuenta/i },
  { id: 'login', test: /iniciar sesi[oó]n|login|entrar|contrase[nñ]a|email o usuario|olvid[eé].*clave/i },
  { id: 'plans', test: /plan|precio|tarif|oro|plata|gratis|pagar|upgrade|cu[aá]nto (cuesta|sale)/i },
  { id: 'contact', test: /contact|buz[oó]n|escribirles|enviar(les)? un mensaje|hablar con|soporte/i },
  { id: 'profile', test: /perfil|dni|mis datos/i },
  { id: 'submissions', test: /solicitud|tr[aá]mite|mis mensajes|estado de mi/i },
  { id: 'owner_panel', test: /mis comercios|mi panel|productos|faqs|sucursal|due[nñ]o/i },
  { id: 'admin_guard', test: /ai guard|flagged|moderar/i },
  { id: 'admin_validate', test: /validar|pendiente|cola admin|aprobar/i },
  { id: 'list_articles', test: /revista|art[ií]culo|noticia|magazine|nota(s)?\b|leer\b/i },
  { id: 'list_events', test: /evento|agenda|pe[nñ]a|folklore|qu[eé] hay.*(noche|finde|viernes)|recital|show|fiesta|salida(s)?\b|qu[eé] hacer.*(noche|finde)/i },
  { id: 'list_commerces', test: /comercio|local(es)?|lugares|sitios|resto|bar|d[oó]nde (comer|salir|ir|tomar)|gastronom|casona|teatro|caf[eé]|boliche|parrilla|pizza|cerveza/i },
  { id: 'discover', test: /mostr(ame|á)|list(á|ame)|recomend|suger[ií]|descubr|qu[eé] hay|qu[eé] (puedo|podemos) (hacer|visitar|ver)|busc(ame|á|a)|conoc[eé]s|ten[eé]s|hay algo|opciones/i },
  { id: 'overview', test: /qu[eé] (es|puedo)|hola|buenas|buenos d[ií]as|ayud[aeá]|c[oó]mo funciona|para qu[eé] sirve|qui[eé]n sos/i },
];

export function detectIntent(text) {
  const raw = String(text || '').trim();
  if (!raw) return 'overview';
  const found = INTENTS.find((item) => item.test.test(raw));
  if (found) return found.id;

  // Preguntas / búsquedas abiertas → descubrir (buscar en catálogo + responder)
  if (
    /\?$/.test(raw) ||
    /\b(d[oó]nde|c[oó]mo|cu[aá]ndo|por qu[eé]|alguna|alguno|busco|necesito|quiero|gusta|recomenda)/i.test(raw) ||
    raw.split(/\s+/).filter(Boolean).length >= 3
  ) {
    return 'discover';
  }
  return 'overview';
}
const STOPWORDS = new Set([
  'me', 'mi', 'mis', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'en', 'por', 'para', 'con', 'y', 'o', 'a',
  'que', 'qué', 'hay', 'hoy', 'ahora', 'algo', 'algunos', 'algunas',
  'mostrar', 'mostrame', 'mostrá', 'mostra', 'lista', 'listame', 'listá',
  'ver', 'dame', 'quiero', 'quisiera', 'buscá', 'busca', 'buscame',
  'recomendame', 'recomendá', 'recomenda', 'sugerí', 'sugiere',
  'lugares', 'lugar', 'sitios', 'sitio', 'algun', 'algún', 'porfa', 'porfis',
  'pandora', 'salta', 'podes', 'podés', 'puedo', 'podemos', 'hacer', 'visitar',
]);

const TYPE_WORDS = {
  commerce: ['comercio', 'comercios', 'local', 'locales', 'resto', 'bar', 'café', 'cafe'],
  event: ['evento', 'eventos', 'agenda', 'peña', 'pena', 'recital', 'show'],
  article: ['revista', 'artículo', 'articulo', 'artículos', 'articulos', 'noticia', 'notas', 'magazine'],
};

const CATEGORY_ALIASES = [
  { test: /gastro|restauran|\brestos?\b|comida|empanada|caf[eé]|parrilla|d[oó]nde comer/i, cats: ['GASTRONOMIA', 'RESTAURANTES', 'CAFETERIAS'] },
  { test: /\bbares?\b|boliche|nocturn|tragos?/i, cats: ['VIDA_NOCTURNA', 'BARES'] },
  { test: /teatro|sala(s)?\b|cultura|obra/i, cats: ['SALAS_Y_TEATRO', 'CULTURA'] },
  { test: /turis|paseo|cerro|plaza/i, cats: ['TURISMO'] },
  { test: /compra|tienda|shop/i, cats: ['COMPRAS', 'TIENDAS'] },
  { test: /hotel|aloj/i, cats: ['HOTELES'] },
];

const ENUM_LABELS = {
  GASTRONOMIA: 'Gastronomía',
  VIDA_NOCTURNA: 'Vida nocturna',
  SALAS_Y_TEATRO: 'Salas y teatro',
  TURISMO: 'Turismo',
  COMPRAS: 'Compras',
  SERVICIOS: 'Servicios',
  DEPORTES: 'Deportes',
  CULTURA: 'Cultura',
  HOTELES: 'Hoteles',
  RESTAURANTES: 'Restaurantes',
  BARES: 'Bares',
  CAFETERIAS: 'Cafeterías',
  TIENDAS: 'Tiendas',
  ENTRETENIMIENTO: 'Entretenimiento',
};

export function humanizeLabel(value, fallback = '') {
  if (value == null || value === '') return fallback;
  const raw = String(value).trim();
  const key = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (ENUM_LABELS[key]) return ENUM_LABELS[key];
  if (raw.includes('_')) {
    return raw.split('_').filter(Boolean)
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
  return raw;
}

export function actionsFor(intent, role = 'GUEST') {
  const guest = role === 'GUEST';
  const owner = role === 'OWNER' || role === 'ADMIN';
  const signed = role !== 'GUEST';

  const map = {
    overview: guest
      ? [
          { label: 'Ver comercios', to: '/commerces' },
          { label: 'Ver eventos', to: '/events' },
          { label: 'Crear cuenta', to: '/register' },
        ]
      : role === 'ADMIN'
        ? [
            { label: 'Validar comercios', to: '/admin/commerces' },
            { label: 'Buzón', to: '/admin/submissions' },
            { label: 'Panel admin', to: '/admin/dashboard' },
          ]
        : role === 'OWNER'
          ? [
              { label: 'Mis comercios', to: '/my-commerces' },
              { label: 'Solicitar evento', to: '/events/create' },
              { label: 'Ver planes', to: '/pricing' },
            ]
          : [
              { label: 'Ver comercios', to: '/commerces' },
              { label: 'Cargar mi local', to: '/commerces/create' },
              { label: 'Mi perfil', to: '/profile' },
            ],
    list_commerces: [{ label: 'Ver todos los comercios', to: '/commerces' }],
    list_events: [{ label: 'Abrir la agenda', to: '/events' }],
    list_articles: [{ label: 'Abrir la revista', to: '/magazine' }],
    discover: [
      { label: 'Comercios', to: '/commerces' },
      { label: 'Agenda', to: '/events' },
      { label: 'Revista', to: '/magazine' },
    ],
    register: [
      { label: 'Crear cuenta', to: '/register' },
      { label: 'Ya tengo cuenta', to: '/login' },
    ],
    login: [{ label: 'Iniciar sesión', to: '/login' }],
    create_commerce: guest
      ? [{ label: 'Crear cuenta para cargar el local', to: '/register' }]
      : [{ label: 'Cargar mi comercio', to: '/commerces/create' }],
    create_event: owner
      ? [{ label: 'Solicitar evento', to: '/events/create' }]
      : signed
        ? [{ label: 'Primero cargá un comercio', to: '/commerces/create' }]
        : [{ label: 'Crear cuenta', to: '/register' }],
    favorite: guest
      ? [{ label: 'Entrar para guardar favoritos', to: '/login' }]
      : [
          { label: 'Explorar comercios', to: '/commerces' },
          { label: 'Ver mis favoritos', to: '/profile' },
        ],
    comment: [
      { label: 'Elegir un comercio', to: '/commerces' },
    ],
    plans: [{ label: 'Ver planes', to: '/pricing' }],
    contact: [{ label: 'Enviar un mensaje', to: '/contact' }],
    profile: signed
      ? [{ label: 'Ir a mi perfil', to: '/profile' }]
      : [{ label: 'Iniciar sesión', to: '/login' }],
    submissions: signed
      ? [{ label: 'Mis solicitudes', to: '/my-submissions' }, { label: 'Nuevo mensaje', to: '/contact' }]
      : [{ label: 'Contacto', to: '/contact' }],
    owner_panel: owner
      ? [
          { label: 'Mi panel', to: '/my-dashboard' },
          { label: 'Mis comercios', to: '/my-commerces' },
        ]
      : [{ label: 'Cargar un comercio', to: '/commerces/create' }],
    admin_validate: role === 'ADMIN'
      ? [
          { label: 'Comercios pendientes', to: '/admin/commerces' },
          { label: 'Eventos', to: '/admin/events' },
          { label: 'Buzón', to: '/admin/submissions' },
        ]
      : [{ label: 'Inicio', to: '/' }],
    admin_guard: role === 'ADMIN'
      ? [
          { label: 'AI Guard', to: '/admin/dashboard' },
          { label: 'Comercios pendientes', to: '/admin/commerces' },
        ]
      : [{ label: 'Inicio', to: '/' }],
  };

  return map[intent] || map.overview;
}

export function processHint(intent, role = 'GUEST') {
  const hints = {
    overview: 'Explicá para qué sirve PANDORA (descubrir Salta: locales, agenda y revista; no hay carrito). Respondé también si preguntó otra cosa concreta sobre la app. Ofrecé 2 caminos: explorar o cargar un local.',
    list_commerces: 'Hay tarjetas reales abajo (foto, rubro, dirección). En 2 frases presentá el listado y decí que toque una para ver el detalle, o “Ver todos”. No copies los nombres.',
    list_events: 'Hay tarjetas de eventos abajo con fecha. Contá que la agenda pública muestra lo aprobado y que puede abrir uno. No copies toda la lista.',
    list_articles: 'Hay notas de la revista abajo. Invitalo a abrir una o ir a Magazine. No copies los títulos.',
    discover: 'Respondé a la pregunta concreta. Si hay fichas abajo, presentalas en 1-2 frases. Si es cómo usar la app, explicá el trámite. Si no hay match, decilo y ofrecé explorar comercios/eventos/revista.',
    register: 'Pasos: Registrarse, correo + usuario + contraseña, código OTP del mail. Después puede guardar favoritos y dar de alta un local (queda PENDING).',
    login: 'Se entra con email o usuario (da igual) y la contraseña. Si no tiene cuenta, registrarse.',
    create_commerce: role === 'GUEST'
      ? 'Sin sesión no puede publicar. Primero cuenta, después alta: nombre, categoría, fotos. Queda PENDING hasta que un admin lo apruebe.'
      : 'Alta de comercio: nombre, categoría, descripción, dirección, fotos. Enviar solicitud. Queda PENDING. Free = 1 foto y 1 categoría.',
    create_event: role === 'OWNER' || role === 'ADMIN'
      ? 'Eventos: se piden desde un comercio propio. Básico gratis; Plus/Premium piden comprobante. Quedan PENDING hasta el admin.'
      : 'Para pedir un evento primero tiene que tener un comercio (USER carga el local y espera validación).',
    favorite: 'Hay locales abajo para elegir. En la ficha, corazón Guardar. Hace falta sesión. Se ven en Perfil.',
    comment: 'Hay locales abajo. En la ficha, abajo, deja opinión con puntaje. El dueño (plan Plata u Oro) puede responder.',
    plans: 'Free: 1 foto, 1 categoría. Plata: productos y respuestas. Oro: FAQs, más fotos, destacado. Se pide upgrade por contacto/comprobante, no hay carrito.',
    contact: 'Contacto es el buzón: consulta, publicidad, revista o cambio de plan. Adjunto opcional. La respuesta llega a Mis solicitudes.',
    profile: 'Perfil: DNI, favoritos, cerrar sesión. Mis solicitudes es el seguimiento de trámites.',
    submissions: 'Mis solicitudes muestra contactos y cambios de plan con la respuesta del admin.',
    owner_panel: 'OWNER edita ficha, sucursales, productos (Plata+), FAQs (Oro), responde comentarios (Plata+).',
    admin_validate: 'Admin valida comercios y eventos PENDING, buzón y magazine. El Guard no bloquea altas: las lista para revisar qué pasó.',
    admin_guard: 'AI Guard intercepta altas y ediciones: no las bloquea, las lista para que el admin las abra y decida.',
  };
  return hints[intent] || hints.overview;
}

function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function blobOf(item) {
  return [
    item.label,
    item.hint,
    item.meta,
    item.category,
    item.searchText,
    item.type,
  ].filter(Boolean).join(' ').toLowerCase();
}

function scoreItem(item, tokens) {
  if (!tokens.length) return 1;
  const blob = blobOf(item);
  let score = 0;
  tokens.forEach((token) => {
    if (String(item.label || '').toLowerCase().includes(token)) score += 4;
    else if (blob.includes(token)) score += 2;
  });
  return score;
}

function categoryCats(query) {
  const match = CATEGORY_ALIASES.find((alias) => alias.test.test(query));
  return match?.cats || [];
}

function filterByTypeWords(tokens, type) {
  const skip = new Set(TYPE_WORDS[type] || []);
  return tokens.filter((token) => !skip.has(token));
}

function pickList(list, query, type, limit) {
  const cats = type === 'commerce' ? categoryCats(query) : [];
  let pool = list;
  if (cats.length) {
    const narrowed = list.filter((item) => cats.includes(String(item.category || '').toUpperCase()));
    if (narrowed.length) pool = narrowed;
  }
  const tokens = filterByTypeWords(tokenize(query), type);
  if (!tokens.length) return pool.slice(0, limit);
  const ranked = pool
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
  return (ranked.length ? ranked : pool).slice(0, limit);
}

function searchNamed(catalog, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const all = [
    ...(catalog.commerces || []),
    ...(catalog.events || []),
    ...(catalog.articles || []),
  ];
  // Solo matches fuertes por nombre (score >= 4 = token en el label)
  return all
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item)
    .slice(0, 8);
}

function hasNameTokens(query, type) {
  return filterByTypeWords(tokenize(query), type).length > 0;
}

export function itemsFor(intent, catalog, query = '') {
  const commerces = catalog?.commerces || [];
  const events = catalog?.events || [];
  const articles = catalog?.articles || [];
  const named = searchNamed({ commerces, events, articles }, query);
  const namedOf = (type) => named.filter((item) => item.type === type);

  // Listados explícitos: siempre devolver varios (8), salvo que pidan un nombre concreto con match fuerte
  if (intent === 'list_commerces') {
    const hits = namedOf('commerce');
    if (hits.length >= 2 && hasNameTokens(query, 'commerce')) return hits.slice(0, 8);
    if (hits.length === 1 && hasNameTokens(query, 'commerce')) {
      // Un nombre puntual: igual rellená con del mismo rubro / más locales
      const rest = pickList(commerces, query, 'commerce', 8).filter((item) => item.id !== hits[0].id);
      return [hits[0], ...rest].slice(0, 8);
    }
    return pickList(commerces, query, 'commerce', 8);
  }
  if (intent === 'list_events') {
    const hits = namedOf('event');
    if (hits.length >= 2 && hasNameTokens(query, 'event')) return hits.slice(0, 8);
    if (hits.length === 1 && hasNameTokens(query, 'event')) {
      const rest = pickList(events, query, 'event', 8).filter((item) => item.id !== hits[0].id);
      return [hits[0], ...rest].slice(0, 8);
    }
    return pickList(events, query, 'event', 8);
  }
  if (intent === 'list_articles') {
    const hits = namedOf('article');
    if (hits.length >= 2 && hasNameTokens(query, 'article')) return hits.slice(0, 6);
    if (hits.length === 1 && hasNameTokens(query, 'article')) {
      const rest = pickList(articles, query, 'article', 6).filter((item) => item.id !== hits[0].id);
      return [hits[0], ...rest].slice(0, 6);
    }
    return pickList(articles, query, 'article', 6);
  }
  if (intent === 'discover') {
    if (named.length >= 2) return named.slice(0, 8);
    if (named.length === 1) {
      return [
        named[0],
        ...pickList(commerces, query, 'commerce', 3),
        ...pickList(events, query, 'event', 2),
        ...pickList(articles, query, 'article', 2),
      ]
        .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)
        .slice(0, 8);
    }
    return [
      ...pickList(commerces, query, 'commerce', 4),
      ...pickList(events, query, 'event', 3),
      ...pickList(articles, query, 'article', 2),
    ].slice(0, 8);
  }
  if (intent === 'comment' || intent === 'favorite') {
    return pickList(commerces, query, 'commerce', 6);
  }
  // overview u otros: un solo match fuerte por nombre = esa ficha; si no, mezcla
  if (named.length === 1) return named;
  if (named.length > 1) return named.slice(0, 6);
  if (tokenize(query).length) {
    return [
      ...pickList(commerces, query, 'commerce', 4),
      ...pickList(events, query, 'event', 2),
      ...pickList(articles, query, 'article', 2),
    ].slice(0, 8);
  }
  return [];
}
