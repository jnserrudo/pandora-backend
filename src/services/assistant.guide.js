const INTENTS = [
  { id: 'create_commerce', test: /carg(ar|o)|alta de|sumar mi|publicar.*(local|comer)|mi local|mi comercio/i },
  { id: 'create_event', test: /(crear|cargar|solicitar|publicar).*(evento)|evento.*(crear|cargar|solicitar)/i },
  { id: 'favorite', test: /favorit/i },
  { id: 'comment', test: /coment|opini[oó]n|rese[nñ]a/i },
  { id: 'register', test: /registr|crear cuenta|sign ?up|hacer(me)? socio/i },
  { id: 'login', test: /iniciar sesi[oó]n|login|entrar|contrase[nñ]a|email o usuario/i },
  { id: 'plans', test: /plan|precio|oro|plata|gratis|pagar|upgrade/i },
  { id: 'contact', test: /contact|buz[oó]n|escribirles|enviar(les)? un mensaje/i },
  { id: 'profile', test: /perfil|dni/i },
  { id: 'submissions', test: /solicitud|tr[aá]mite|mis mensajes/i },
  { id: 'owner_panel', test: /mis comercios|mi panel|productos|faqs|sucursal/i },
  { id: 'admin_guard', test: /ai guard|flagged|moderar/i },
  { id: 'admin_validate', test: /validar|pendiente|cola admin|aprobar/i },
  { id: 'list_articles', test: /revista|art[ií]culo|noticia|magazine|nota(s)?\b/i },
  { id: 'list_events', test: /evento|agenda|pe[nñ]a|folklore|qu[eé] hay.*(noche|finde|viernes)|recital|show/i },
  { id: 'list_commerces', test: /comercio|local(es)?|lugares|sitios|resto|bar|d[oó]nde (comer|salir|ir)|gastronom|casona|teatro|caf[eé]/i },
  { id: 'discover', test: /mostr(ame|á)|list(á|ame)|recomend|suger[ií]|descubr|qu[eé] hay|qu[eé] (puedo|podemos) (hacer|visitar|ver)/i },
  { id: 'overview', test: /qu[eé] (es|puedo)|hola|buenas|ayud[aeá]|c[oó]mo funciona|para qu[eé] sirve/i },
];

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

export function detectIntent(text) {
  const raw = String(text || '').trim();
  const found = INTENTS.find((item) => item.test.test(raw));
  return found?.id || 'overview';
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
    overview: 'Explicá para qué sirve PANDORA (descubrir Salta: locales, agenda y revista; no hay carrito). Ofrecé 2 caminos: explorar o cargar un local.',
    list_commerces: 'Hay tarjetas reales abajo (foto, rubro, dirección). En 2 frases presentá el listado y decí que toque una para ver el detalle, o “Ver todos”. No copies los nombres.',
    list_events: 'Hay tarjetas de eventos abajo con fecha. Contá que la agenda pública muestra lo aprobado y que puede abrir uno. No copies toda la lista.',
    list_articles: 'Hay notas de la revista abajo. Invitalo a abrir una o ir a Magazine. No copies los títulos.',
    discover: 'Hay una mezcla de fichas reales abajo. En 2 frases invitalo a mirar las tarjetas o a filtrar por comercios, eventos o revista.',
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
  return all
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item)
    .slice(0, 6);
}

export function itemsFor(intent, catalog, query = '') {
  const commerces = catalog?.commerces || [];
  const events = catalog?.events || [];
  const articles = catalog?.articles || [];
  const named = searchNamed({ commerces, events, articles }, query);

  if (named.length === 1) return named;

  const namedOf = (type) => named.filter((item) => item.type === type);

  if (intent === 'list_commerces') {
    return namedOf('commerce').length ? namedOf('commerce') : pickList(commerces, query, 'commerce', 8);
  }
  if (intent === 'list_events') {
    return namedOf('event').length ? namedOf('event') : pickList(events, query, 'event', 8);
  }
  if (intent === 'list_articles') {
    return namedOf('article').length ? namedOf('article') : pickList(articles, query, 'article', 6);
  }
  if (intent === 'discover') {
    return named.length
      ? named
      : [
          ...pickList(commerces, query, 'commerce', 3),
          ...pickList(events, query, 'event', 3),
          ...pickList(articles, query, 'article', 2),
        ];
  }
  if (intent === 'comment' || intent === 'favorite') {
    return pickList(commerces, query, 'commerce', 5);
  }
  if (named.length) return named.slice(0, 4);
  return [];
}
