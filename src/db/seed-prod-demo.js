// backend/src/db/seed-prod-demo.js
// Prod demo: NO toca jnserrudo/nprueba. Borra el resto (+ sus datos). Solo AGREGA lo faltante del seed.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertMutableDatabase, getDatabaseHost } from './databaseTarget.js';

assertMutableDatabase();

if (process.env.CONFIRM_PROD_SEED !== 'true') {
  console.error(
    '[seed-prod-demo] Abortado: falta CONFIRM_PROD_SEED=true.\n' +
      'Ejemplo: CONFIRM_PROD_SEED=true npm run db:seed:prod-demo'
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'PandoraDemo2026!';
const KEEP_USERNAMES = new Set(['jnserrudo', 'nprueba']);

const img = (name) => `/seed/${name}`;
const days = (n) => new Date(Date.now() + n * 86400000);
const hours = (n) => new Date(Date.now() + n * 3600000);
const SALTA = { lat: -24.7893, lng: -65.4103 };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, '../../public/seed');

async function ensure(model, where, create) {
  const existing = await prisma[model].findFirst({ where });
  if (existing) return { record: existing, created: false };
  const record = await prisma[model].create({ data: create });
  return { record, created: true };
}

async function wipeNonKeepers() {
  const allUsers = await prisma.user.findMany({ select: { id: true, username: true, email: true } });
  const keepers = allUsers.filter((u) => KEEP_USERNAMES.has(u.username.toLowerCase()));
  const toDelete = allUsers.filter((u) => !KEEP_USERNAMES.has(u.username.toLowerCase()));

  if (keepers.length < 2) {
    const found = keepers.map((u) => u.username).join(', ') || '(ninguno)';
    throw new Error(
      `Se necesitan jnserrudo y nprueba sin modificarlos. Encontrados: ${found}. Abortando.`
    );
  }

  const deleteIds = toDelete.map((u) => u.id);
  console.log(
    `[wipe] Keepers intactos: ${keepers.map((u) => u.username).join(', ')}. ` +
      `A borrar: ${toDelete.length} user(s)${toDelete.length ? ` (${toDelete.map((u) => u.username).join(', ')})` : ''}.`
  );

  if (deleteIds.length === 0) {
    console.log('[wipe] Nada que borrar.');
    return;
  }

  const orphanCommerces = await prisma.commerce.findMany({
    where: { ownerId: { in: deleteIds } },
    select: { id: true, name: true }
  });
  const commerceIds = orphanCommerces.map((c) => c.id);
  console.log(`[wipe] Comercios de no-keepers: ${commerceIds.length}`);

  if (commerceIds.length) {
    await prisma.favorite.deleteMany({
      where: { resourceType: 'commerce', resourceId: { in: commerceIds } }
    });
    const events = await prisma.event.findMany({
      where: { commerceId: { in: commerceIds } },
      select: { id: true }
    });
    const eventIds = events.map((e) => e.id);
    if (eventIds.length) {
      await prisma.favorite.deleteMany({
        where: { resourceType: 'event', resourceId: { in: eventIds } }
      });
    }

    await prisma.commerceComment.deleteMany({ where: { commerceId: { in: commerceIds } } });
    await prisma.commerceAdvisory.deleteMany({ where: { commerceId: { in: commerceIds } } });
    await prisma.product.deleteMany({ where: { commerceId: { in: commerceIds } } });
    await prisma.fAQ.deleteMany({ where: { commerceId: { in: commerceIds } } });
    await prisma.event.deleteMany({ where: { commerceId: { in: commerceIds } } });
    await prisma.advertisement.deleteMany({ where: { commerceId: { in: commerceIds } } });
    await prisma.planHistory.deleteMany({ where: { commerceId: { in: commerceIds } } });
    await prisma.branch.deleteMany({ where: { commerceId: { in: commerceIds } } });

    for (const id of commerceIds) {
      await prisma.commerce.update({
        where: { id },
        data: { categories: { set: [] } }
      });
    }
    await prisma.commerce.deleteMany({ where: { id: { in: commerceIds } } });
  }

  const articles = await prisma.article.findMany({
    where: { authorId: { in: deleteIds } },
    select: { id: true }
  });
  const articleIds = articles.map((a) => a.id);
  if (articleIds.length) {
    await prisma.favorite.deleteMany({
      where: { resourceType: 'article', resourceId: { in: articleIds } }
    });
    await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
  }

  await prisma.favorite.deleteMany({ where: { userId: { in: deleteIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: deleteIds } } });
  await prisma.verificationToken.deleteMany({ where: { userId: { in: deleteIds } } });
  await prisma.submission.deleteMany({ where: { userId: { in: deleteIds } } });
  await prisma.commerceComment.deleteMany({ where: { userId: { in: deleteIds } } });
  await prisma.commerceAdvisory.deleteMany({ where: { advisorId: { in: deleteIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: deleteIds } } });
  await prisma.moderationLog.updateMany({
    where: { reviewedBy: { in: deleteIds } },
    data: { reviewedBy: null }
  });

  // FKs opcionales en comercios de keepers que apuntan a users borrados
  await prisma.commerce.updateMany({
    where: { validatedById: { in: deleteIds } },
    data: { validatedById: null }
  });
  await prisma.commerce.updateMany({
    where: { accountExecutiveId: { in: deleteIds } },
    data: { accountExecutiveId: null }
  });

  await prisma.newsletterSubscription.updateMany({
    where: { userId: { in: deleteIds } },
    data: { userId: null }
  });

  await prisma.user.deleteMany({ where: { id: { in: deleteIds } } });
  console.log(`[wipe] Users borrados: ${deleteIds.length}`);
}

async function seedAddOnly() {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  const { record: admin, created: adminCreated } = await ensure(
    'user',
    { email: 'admin@pandora.com' },
    {
      email: 'admin@pandora.com',
      username: 'admin',
      name: 'Admin Pandora',
      role: 'ADMIN',
      password,
      isVerified: true
    }
  );
  const { record: owner, created: ownerCreated } = await ensure(
    'user',
    { email: 'owner@pandora.com' },
    {
      email: 'owner@pandora.com',
      username: 'owner',
      name: 'Lucía Casona',
      role: 'OWNER',
      password,
      isVerified: true
    }
  );
  const { record: owner2, created: owner2Created } = await ensure(
    'user',
    { email: 'owner2@pandora.com' },
    {
      email: 'owner2@pandora.com',
      username: 'owner2',
      name: 'Martín Peña',
      role: 'OWNER',
      password,
      isVerified: true
    }
  );
  const { record: user, created: userCreated } = await ensure(
    'user',
    { email: 'user@pandora.com' },
    {
      email: 'user@pandora.com',
      username: 'user',
      name: 'Ana Socio',
      role: 'USER',
      password,
      isVerified: true
    }
  );
  const { record: user2, created: user2Created } = await ensure(
    'user',
    { email: 'user2@pandora.com' },
    {
      email: 'user2@pandora.com',
      username: 'user2',
      name: 'Diego Visitante',
      role: 'USER',
      password,
      isVerified: true
    }
  );
  console.log(
    `[seed] Users demo: admin=${adminCreated ? 'created' : 'skip'} owner=${ownerCreated ? 'created' : 'skip'} ` +
      `owner2=${owner2Created ? 'created' : 'skip'} user=${userCreated ? 'created' : 'skip'} user2=${user2Created ? 'created' : 'skip'}`
  );

  const planDefs = [
    {
      level: 1,
      name: 'Free',
      price: 0,
      description: 'Presencia básica en el mapa de Salta',
      benefits: '1 foto\n1 categoría\n1 sucursal\nFicha pública con horarios y contacto',
    },
    {
      level: 2,
      name: 'Plata',
      price: 15000,
      description: 'Más visibilidad y herramientas',
      benefits:
        'Hasta 10 fotos\nHasta 3 categorías\nHasta 3 sucursales\nCatálogo de productos\nRespuesta a comentarios\nTeléfono y link externo visibles',
    },
    {
      level: 3,
      name: 'Oro',
      price: 30000,
      description: 'Máxima exposición',
      benefits:
        'Galería amplia\nFAQs en la ficha\nDestacado en listados\nVideo y menú externo\nTodo lo de Plata',
    },
    {
      level: 4,
      name: 'Platino',
      price: 50000,
      description: 'Socio Pandora con el techo del plan',
      benefits:
        'Todo lo de Oro\nLímites altos de galería y sucursales\nPrioridad en destacados\nSoporte preferencial',
    },
  ];
  for (const plan of planDefs) {
    await prisma.plan.upsert({
      where: { level: plan.level },
      update: {
        name: plan.name,
        price: plan.price,
        description: plan.description,
        benefits: plan.benefits,
      },
      create: plan,
    });
  }
  const planFree = await prisma.plan.findUnique({ where: { level: 1 } });
  const planPlata = await prisma.plan.findUnique({ where: { level: 2 } });
  const planOro = await prisma.plan.findUnique({ where: { level: 3 } });

  const { record: catNews } = await ensure(
    'articleCategory',
    { name: 'Noticias' },
    { name: 'Noticias', slug: 'noticias' }
  );
  const { record: catInterviews } = await ensure(
    'articleCategory',
    { name: 'Entrevistas' },
    { name: 'Entrevistas', slug: 'entrevistas' }
  );
  const { record: catAgenda } = await ensure(
    'articleCategory',
    { name: 'Agenda' },
    { name: 'Agenda', slug: 'agenda' }
  );

  const commerceCats = [
    { name: 'Vida Nocturna', slug: 'VIDA_NOCTURNA', description: 'Bares, peñas y after de Salta', showOnHome: true, homeOrder: 1 },
    { name: 'Gastronomía', slug: 'GASTRONOMIA', description: 'Restaurantes, cafés y regional', showOnHome: true, homeOrder: 2 },
    { name: 'Salas y Teatro', slug: 'SALAS_Y_TEATRO', description: 'Teatros, salas y cultura en vivo', showOnHome: true, homeOrder: 3 },
  ];
  for (const cat of commerceCats) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {
        slug: cat.slug,
        description: cat.description,
        showOnHome: cat.showOnHome,
        homeOrder: cat.homeOrder,
      },
      create: cat,
    });
  }
  const catGastro = await prisma.category.findUnique({ where: { name: 'Gastronomía' } });
  const catNight = await prisma.category.findUnique({ where: { name: 'Vida Nocturna' } });
  const catTheater = await prisma.category.findUnique({ where: { name: 'Salas y Teatro' } });

  await ensure(
    'coupon',
    { code: 'SALTA20' },
    { code: 'SALTA20', discountPercent: 20, isActive: true, expiresAt: days(60) }
  );
  await ensure(
    'coupon',
    { code: 'ORO10' },
    { code: 'ORO10', discountPercent: 10, isActive: true, expiresAt: days(15) }
  );

  async function ensureCommerce(name, data) {
    return ensure('commerce', { name }, { name, ...data });
  }

  const { record: casona, created: casonaNew } = await ensureCommerce('La Casona de Salta', {
    shortDescription: 'Cocina regional, patio colonial y folklore los viernes.',
    description:
      'La Casona de Salta es una casona de principios del siglo XX en el casco histórico. Locro, empanadas al horno de barro, carta de vinos del valle Calchaquí y peña los viernes. Ideal para grupos y visitas que buscan la mesa salteña sin apuro.',
    address: 'Caseros 467, Salta Capital',
    phone: '+54 387 421-8800',
    whatsapp: '3874218800',
    category: 'GASTRONOMIA',
    coverImage: img('la-casona-cover.png'),
    galleryImages: [
      img('la-casona-cover.png'),
      img('la-casona-food.png'),
      img('product-wine.png'),
      img('event-folklore.png'),
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1024&auto=format&fit=crop'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    website: 'https://lacasonadesalta.example',
    instagram: 'https://instagram.com/lacasonadesalta',
    facebook: 'https://facebook.com/lacasonadesalta',
    externalLink: 'https://lacasonadesalta.example/carta',
    attributes: [
      'wifi',
      'ac',
      'cards',
      'virtual_wallet',
      'wine_menu',
      'gluten_free',
      'pet_friendly',
      'groups',
      'parking',
      'local_produce',
      'wheelchair',
      'cash_discount'
    ],
    latitude: SALTA.lat,
    longitude: SALTA.lng,
    openingHours: 'Lun a Jue 12:00-16:00 y 20:00-00:00\nVie-Sáb 12:00-16:00 y 20:00-01:30\nDom 12:00-17:00',
    isVerified: true,
    status: 'ACTIVE',
    isActive: true,
    planLevel: 3,
    isFeatured: true,
    featuredUntil: days(25),
    totalComments: 3,
    averageRating: 4.7,
    validatedById: admin.id,
    validatedAt: days(-20),
    accountExecutiveId: admin.id,
    ownerId: owner.id,
    planId: planOro.id,
    paymentProof: img('banner-home.png')
  });

  const { record: pena, created: penaNew } = await ensureCommerce('Peña El Cardón', {
    shortDescription: 'Peña con guitarra, vino y empanadas hasta tarde.',
    description:
      'El Cardón es una peña clásica a dos cuadras de la plaza. Shows de folklore los jueves y sábados, mesa compartida y carta corta de vinos y cerveza artesanal. Plan Plata: productos destacados y respuesta a comentarios.',
    address: 'Balcarce 312, Salta Capital',
    phone: '+54 387 422-1100',
    whatsapp: '3874221100',
    category: 'VIDA_NOCTURNA',
    coverImage: img('pena-cover.png'),
    galleryImages: [img('pena-cover.png'), img('event-folklore.png'), img('product-empanada.png'), img('product-wine.png')],
    website: 'https://penaelcardon.example',
    instagram: 'https://instagram.com/penaelcardon',
    facebook: 'https://facebook.com/penaelcardon',
    attributes: ['live_music', 'wine_menu', 'craft_beer', 'cards', 'groups', 'smoking_area', 'extended_hours'],
    latitude: SALTA.lat - 0.002,
    longitude: SALTA.lng + 0.001,
    openingHours: 'Jue a Sáb 21:00-03:00\nDom 12:00-16:00 (almuerzo criollo)',
    isVerified: true,
    status: 'ACTIVE',
    isActive: true,
    planLevel: 2,
    ownerId: owner2.id,
    planId: planPlata.id,
    validatedById: admin.id,
    validatedAt: days(-12),
    paymentProof: img('banner-home.png')
  });

  const { record: cafe, created: cafeNew } = await ensureCommerce('Café del Cerro', {
    shortDescription: 'Café de especialidad con vista al San Bernardo.',
    description:
      'Tostado local, medialunas y WiFi. Plan Free: una sola foto y una categoría, para probar el techo del plan.',
    address: 'Esteban de Luca 155, Salta Capital',
    phone: '+54 387 430-2211',
    category: 'GASTRONOMIA',
    coverImage: img('cafe-cover.png'),
    galleryImages: [img('cafe-cover.png')],
    instagram: 'https://instagram.com/cafedelcerro',
    attributes: ['wifi', 'specialty_coffee', 'coworking', 'plugs'],
    latitude: SALTA.lat + 0.004,
    longitude: SALTA.lng - 0.003,
    openingHours: 'Lun a Vie 08:00-20:00\nSáb 09:00-18:00',
    status: 'ACTIVE',
    isActive: true,
    planLevel: 1,
    ownerId: owner2.id,
    planId: planFree.id,
    validatedById: admin.id,
    validatedAt: days(-8)
  });

  const { record: teatro, created: teatroNew } = await ensureCommerce('Teatro Victoria', {
    shortDescription: 'Sala histórica con drama, danza y estrenos locales.',
    description:
      'El Victoria combina programación estable y residencias. Platea, palcos y foyer con café. Ficha Oro: video, galería y FAQs de boletería.',
    address: 'Mitre 190, Salta Capital',
    phone: '+54 387 431-4455',
    whatsapp: '3874314455',
    category: 'SALAS_Y_TEATRO',
    coverImage: img('teatro-cover.png'),
    galleryImages: [img('teatro-cover.png'), img('teatro-gallery.png'), img('event-teatro.png')],
    videoUrl: 'https://www.youtube.com/watch?v=Scxs7L0vhZ4',
    website: 'https://teatrovictoria.example',
    instagram: 'https://instagram.com/teatrovictoria',
    facebook: 'https://facebook.com/teatrovictoria',
    externalLink: 'https://teatrovictoria.example/programacion',
    attributes: ['wheelchair', 'accessible_parking', 'cards', 'virtual_wallet', 'ac'],
    latitude: SALTA.lat - 0.001,
    longitude: SALTA.lng - 0.0015,
    openingHours: 'Boletería Mar a Dom 10:00-13:00 y 17:00-21:00\nFunciones según programación',
    isVerified: true,
    status: 'ACTIVE',
    isActive: true,
    planLevel: 3,
    ownerId: owner.id,
    planId: planOro.id,
    validatedById: admin.id,
    validatedAt: days(-30),
    accountExecutiveId: admin.id
  });

  const { record: empanadas, created: empanadasNew } = await ensureCommerce('Empanadas 9 de Julio', {
    shortDescription: 'Horno de barro a una cuadra de la plaza. Alta pendiente.',
    description:
      'Local familiar que acaba de cargar la ficha completa (Plata) y espera validación del admin. Empanadas de corte, humita y rosca. Delivery propio y take away.',
    address: 'España 702, Salta Capital',
    phone: '+54 387 422-9988',
    whatsapp: '3874229988',
    category: 'GASTRONOMIA',
    coverImage: img('empanadas-cover.png'),
    galleryImages: [img('empanadas-cover.png'), img('product-empanada.png'), img('la-casona-food.png')],
    instagram: 'https://instagram.com/empanadas9dejulio',
    website: 'https://empanadas9dejulio.example',
    attributes: ['take_away', 'delivery', 'cash_discount', 'cards', 'local_produce', 'kids_friendly'],
    latitude: SALTA.lat + 0.001,
    longitude: SALTA.lng + 0.002,
    openingHours: 'Mar a Dom 11:00-15:00 y 19:00-23:30',
    status: 'PENDING',
    isActive: true,
    planLevel: 2,
    ownerId: owner2.id,
    planId: planPlata.id,
    paymentProof: img('banner-home.png')
  });

  const { record: barCerrado, created: barNew } = await ensureCommerce('Bar Cerrado', {
    shortDescription: 'Alta rechazada: ficha incompleta y fotos genéricas.',
    description:
      'Este local se usó para probar el rechazo. El admin dejó motivo de validación. No debe verse en el listado público.',
    address: 'Zuviría 1200, Salta Capital',
    phone: '+54 387 400-0000',
    category: 'VIDA_NOCTURNA',
    coverImage: img('bar-cerrado.png'),
    galleryImages: [img('bar-cerrado.png')],
    attributes: ['sports_tv'],
    latitude: SALTA.lat + 0.006,
    longitude: SALTA.lng + 0.004,
    openingHours: 'Sin horario declarado',
    status: 'REJECTED',
    isActive: false,
    planLevel: 1,
    ownerId: owner2.id,
    planId: planFree.id,
    validatedById: admin.id,
    validatedAt: days(-3),
    validationReason:
      'Fotos de stock sin relación con el local y teléfono inexistente. Reenviar con prueba de domicilio.'
  });

  const { record: fogon, created: fogonNew } = await ensureCommerce('Fogón de temporada', {
    shortDescription: 'Asado de campo. Oculto al público (vacaciones).',
    description:
      'Parrilla de fin de semana en Chicoana. El owner lo pasó a INACTIVE por temporada. Sirve para ver el panel owner con un local no público.',
    address: 'Ruta 68 km 32, Chicoana',
    phone: '+54 387 455-1212',
    category: 'GASTRONOMIA',
    coverImage: img('fogon-cover.png'),
    galleryImages: [img('fogon-cover.png'), img('la-casona-food.png')],
    attributes: ['parking', 'groups', 'kids_friendly', 'cards'],
    latitude: -25.105,
    longitude: -65.533,
    openingHours: 'Sáb y Dom 12:00-17:00 (temporada)',
    status: 'INACTIVE',
    isActive: true,
    planLevel: 2,
    ownerId: owner.id,
    planId: planPlata.id,
    validatedById: admin.id,
    validatedAt: days(-40)
  });

  console.log(
    `[seed] Comercios: casona=${casonaNew ? 'new' : 'skip'} pena=${penaNew ? 'new' : 'skip'} ` +
      `cafe=${cafeNew ? 'new' : 'skip'} teatro=${teatroNew ? 'new' : 'skip'} ` +
      `empanadas=${empanadasNew ? 'new' : 'skip'} bar=${barNew ? 'new' : 'skip'} fogon=${fogonNew ? 'new' : 'skip'}`
  );

  // Categorías M2M: solo conectar si el comercio es nuevo (no pisar set de keepers/existentes)
  const catLinks = [
    [casona, casonaNew, [catGastro, catNight]],
    [pena, penaNew, [catNight, catGastro]],
    [cafe, cafeNew, [catGastro]],
    [teatro, teatroNew, [catTheater]],
    [empanadas, empanadasNew, [catGastro]],
    [barCerrado, barNew, [catNight]],
    [fogon, fogonNew, [catGastro]]
  ];
  for (const [commerce, isNew, cats] of catLinks) {
    if (!isNew) continue;
    await prisma.commerce.update({
      where: { id: commerce.id },
      data: { categories: { set: cats.map((c) => ({ id: c.id })) } }
    });
  }

  const branchDefs = [
    {
      commerceId: casona.id,
      name: 'Casa Central',
      address: casona.address,
      phone: casona.phone,
      latitude: casona.latitude,
      longitude: casona.longitude,
      isMain: true,
      openingHours: casona.openingHours
    },
    {
      commerceId: casona.id,
      name: 'Patio Güemes',
      address: 'Av. Bicentenario 890, Salta',
      phone: '+54 387 421-8801',
      latitude: SALTA.lat + 0.008,
      longitude: SALTA.lng + 0.006,
      isMain: false,
      openingHours: 'Vie-Sáb 20:00-01:00'
    },
    { commerceId: pena.id, name: 'Casa Central', address: pena.address, phone: pena.phone, isMain: true },
    { commerceId: cafe.id, name: 'Casa Central', address: cafe.address, phone: cafe.phone, isMain: true },
    { commerceId: teatro.id, name: 'Sala Principal', address: teatro.address, phone: teatro.phone, isMain: true },
    { commerceId: empanadas.id, name: 'Casa Central', address: empanadas.address, phone: empanadas.phone, isMain: true },
    { commerceId: barCerrado.id, name: 'Casa Central', address: barCerrado.address, isMain: true },
    { commerceId: fogon.id, name: 'Campo', address: fogon.address, phone: fogon.phone, isMain: true }
  ];
  for (const b of branchDefs) {
    await ensure('branch', { commerceId: b.commerceId, name: b.name }, b);
  }

  const productDefs = [
    {
      commerceId: casona.id,
      name: 'Locro de olla',
      description: 'Poroto, maíz, chorizo y verdeo. Plato de sábado.',
      price: 8900,
      imageUrl: img('la-casona-food.png')
    },
    {
      commerceId: casona.id,
      name: 'Tabla de quesos y Torrontés',
      description: 'Quesos de altura y copa de torrontés cafetero.',
      price: 12500,
      imageUrl: img('product-wine.png')
    },
    {
      commerceId: casona.id,
      name: 'Empanadas al horno (media docena)',
      description: 'Corte, humita y roquefort.',
      price: 5400,
      imageUrl: img('product-empanada.png')
    },
    {
      commerceId: pena.id,
      name: 'Vino de la casa',
      description: 'Malbec por copa, ideal para la peña.',
      price: 3500,
      imageUrl: img('product-wine.png')
    },
    {
      commerceId: pena.id,
      name: 'Picada criolla',
      description: 'Salames, queso y aceitunas para compartir.',
      price: 9800,
      imageUrl: img('la-casona-food.png')
    },
    {
      commerceId: empanadas.id,
      name: 'Docena mixta',
      description: 'Corte, pollo y humita. Lista en 15 minutos.',
      price: 7200,
      imageUrl: img('product-empanada.png')
    }
  ];
  for (const p of productDefs) {
    await ensure('product', { commerceId: p.commerceId, name: p.name }, p);
  }

  const faqDefs = [
    {
      commerceId: casona.id,
      question: '¿Hay menú vegano?',
      answer:
        'Sí: milanesa de berenjena, locro de calabaza y ensalada de quinoa. Marcá gluten_free al reservar si hace falta.'
    },
    {
      commerceId: casona.id,
      question: '¿Se reserva para grupos?',
      answer: 'Grupos de 6 o más por WhatsApp al 3874218800. Señal del 30% sábados.'
    },
    {
      commerceId: casona.id,
      question: '¿Hay estacionamiento?',
      answer: 'Cochera convenida a media cuadra y algunas plazas en Caseros.'
    },
    {
      commerceId: teatro.id,
      question: '¿Cómo retiro entradas?',
      answer: 'Boletería o link de este evento. Estudiantes con DNI 20% mar/jue.'
    },
    {
      commerceId: teatro.id,
      question: '¿Hay acceso para silla de ruedas?',
      answer: 'Platea baja y baño adaptado. Avisá a boletería para ubicar.'
    }
  ];
  for (const f of faqDefs) {
    await ensure('fAQ', { commerceId: f.commerceId, question: f.question }, f);
  }

  const commentDefs = [
    {
      commerceId: casona.id,
      userId: user.id,
      comment: 'El locro del sábado y el patio iluminado. Volvería seguro.',
      rating: 5,
      category: 'CALIDAD',
      isRead: true,
      commerceReply: 'Gracias Ana, los esperamos el viernes de peña.'
    },
    {
      commerceId: casona.id,
      userId: user2.id,
      comment: 'Un poco de espera el viernes, pero el servicio lo compensó.',
      rating: 4,
      category: 'SERVICIO',
      isRead: true,
      commerceReply: 'Abrimos una ronda más de cocina a las 22. Perdón la demora.'
    },
    {
      commerceId: casona.id,
      userName: 'Turista de Tucumán',
      comment: 'Precios de ciudad, porciones generosas. Ambiente romántico.',
      rating: 5,
      category: 'AMBIENTE',
      isRead: false
    },
    {
      commerceId: pena.id,
      userId: user.id,
      comment: 'La guitarra a las 23:30 y el vino de la casa. Ideal grupos.',
      rating: 5,
      category: 'AMBIENTE',
      isRead: true,
      commerceReply: '¡Los jueves hay ronda abierta!'
    },
    {
      commerceId: cafe.id,
      userId: user2.id,
      comment: 'Buen café, un solo enchufe cerca de la ventana.',
      rating: 4,
      category: 'PRECIO',
      isRead: false
    }
  ];
  for (const c of commentDefs) {
    const where = c.userId
      ? { commerceId: c.commerceId, userId: c.userId, comment: c.comment }
      : { commerceId: c.commerceId, userName: c.userName, comment: c.comment };
    await ensure('commerceComment', where, c);
  }

  await ensure(
    'commerceAdvisory',
    { commerceId: casona.id, title: 'Subí el menú de invierno al link externo' },
    {
      commerceId: casona.id,
      advisorId: admin.id,
      title: 'Subí el menú de invierno al link externo',
      content:
        'El tráfico de búsqueda “locro Salta” subió. La ficha Oro ya tiene video; falta destacar el locro en la primera foto.',
      recommendations: '1) Portada con la olla. 2) FAQ de reservas. 3) Evento de peña con ticketUrl.',
      metricsSnapshot: {
        totalComments: 3,
        averageRating: 4.7,
        impressions: 1200,
        clicks: 84,
        ctr: '7.00',
        planLevel: 3
      },
      status: 'SENT'
    }
  );

  await ensure(
    'planHistory',
    { commerceId: casona.id, oldLevel: 1, newLevel: 3, method: 'COUPON' },
    {
      commerceId: casona.id,
      oldLevel: 1,
      newLevel: 3,
      planId: planOro.id,
      couponUsed: 'ORO10',
      discountApplied: 3000,
      totalPaid: 27000,
      method: 'COUPON',
      paymentProof: img('banner-home.png')
    }
  );

  const eventDefs = [
    {
      name: 'Noche de Folklore en La Casona',
      description: 'Tres conjuntos, empanadas de cortesía y vino de la casa. Entrada con cubierto.',
      startDate: hours(72),
      endDate: hours(78),
      coverImage: img('event-folklore.png'),
      galleryImages: [img('event-folklore.png'), img('pena-cover.png')],
      address: casona.address,
      location: 'Patio principal',
      ticketUrl: 'https://lacasonadesalta.example/folklore',
      price: 8000,
      status: 'SCHEDULED',
      isActive: true,
      latitude: casona.latitude,
      longitude: casona.longitude,
      featured: true,
      eventTier: 3,
      paymentProof: img('banner-home.png'),
      paymentStatus: 'VALIDATED',
      videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      externalLink: 'https://lacasonadesalta.example/folklore',
      commerceId: casona.id
    },
    {
      name: 'Almuerzo criollo de domingo',
      description: 'Locro, empanadas y postre regional. Cupos limitados.',
      startDate: hours(120),
      endDate: hours(124),
      coverImage: img('la-casona-food.png'),
      address: casona.address,
      location: 'Salón interior',
      price: 12000,
      status: 'SCHEDULED',
      isActive: true,
      eventTier: 1,
      commerceId: casona.id
    },
    {
      name: 'Ronda abierta El Cardón',
      description: 'Traé la guitarra. Mesa compartida, sin entrada.',
      startDate: hours(48),
      endDate: hours(54),
      coverImage: img('pena-cover.png'),
      address: pena.address,
      status: 'PENDING',
      isActive: true,
      eventTier: 2,
      paymentProof: img('banner-home.png'),
      paymentStatus: 'PENDING',
      commerceId: pena.id
    },
    {
      name: 'Estreno: La casa de los cerros',
      description: 'Drama contemporáneo salteño. Tres funciones de fin de semana.',
      startDate: hours(96),
      endDate: hours(99),
      coverImage: img('event-teatro.png'),
      galleryImages: [img('event-teatro.png'), img('teatro-gallery.png')],
      address: teatro.address,
      location: 'Sala principal',
      ticketUrl: 'https://teatrovictoria.example/entradas',
      price: 6500,
      status: 'SCHEDULED',
      isActive: true,
      featured: true,
      eventTier: 3,
      paymentStatus: 'VALIDATED',
      paymentProof: img('banner-home.png'),
      videoUrl: 'https://www.youtube.com/watch?v=Scxs7L0vhZ4',
      commerceId: teatro.id
    },
    {
      name: 'Función cancelada por lluvia',
      description: 'Se reprograma. Queda en el historial del owner.',
      startDate: hours(-48),
      endDate: hours(-45),
      coverImage: img('teatro-cover.png'),
      status: 'CANCELLED',
      isActive: false,
      eventTier: 1,
      commerceId: teatro.id
    },
    {
      name: 'Peña de prueba — no publicar',
      description: 'Evento de seed rechazado (solo visible en panel admin).',
      startDate: hours(24),
      endDate: hours(28),
      coverImage: img('empanadas-cover.png'),
      status: 'REJECTED',
      isActive: false,
      eventTier: 1,
      commerceId: empanadas.id
    },
    {
      name: 'Peña de mayo (ya pasó)',
      description: 'Evento finalizado para probar el calendario hacia atrás.',
      startDate: hours(-240),
      endDate: hours(-236),
      coverImage: img('event-folklore.png'),
      status: 'FINISHED',
      isActive: true,
      eventTier: 1,
      commerceId: pena.id
    }
  ];
  for (const e of eventDefs) {
    await ensure('event', { name: e.name, commerceId: e.commerceId }, e);
  }

  const folklore = await prisma.event.findFirst({
    where: { name: 'Noche de Folklore en La Casona', commerceId: casona.id },
    orderBy: { id: 'desc' }
  });
  const estreno = await prisma.event.findFirst({
    where: { name: 'Estreno: La casa de los cerros', commerceId: teatro.id },
    orderBy: { id: 'desc' }
  });

  const nocheHtml = `
<p>Salta volvió a llenar los viernes. Entre <a href="/commerce/${pena.id}">Peña El Cardón</a> y las casonas del casco hay una camada de dueños que cargan ficha, fotos reales y horarios. Esta nota recorre tres cuadras: plaza, Balcarce y Caseros.</p>
<h2>Lo que se ve, está abierto</h2>
<p>Lo que se ve en PANDORA es lo que está abierto, no un listado eterno. En el centro, <a href="/commerce/${casona.id}">La Casona de Salta</a> arma la noche con empanadas, vino de la casa y un patio que no finge ser Buenos Aires.</p>
<blockquote>Si el local no tiene foto de verdad y horario, el visitante no sale. La agenda se arma con lo que está vivo.</blockquote>
<ul>
  <li>Peñas con mesa compartida y cubierto claro.</li>
  <li>Teatro con función a la vista, no un afiche eterno.</li>
  <li>Bares del casco que aparecen solo si están activos.</li>
</ul>
<p>El ${estreno ? `<a href="/event/${estreno.id}">estreno en el Teatro Victoria</a>` : 'estreno del Victoria'} y ${folklore ? `<a href="/event/${folklore.id}">la noche de folklore en La Casona</a>` : 'la noche de folklore'} ya están en la agenda pública. Tocá la ficha, mirá el mapa y andá.</p>
`.trim();

  const chefHtml = `
<p>Hablamos en la cocina de <a href="/commerce/${casona.id}">La Casona de Salta</a>. El locro no es un plato de marketing: es el sábado. El chef insiste en proveedores del valle y en explicar el gluten en la FAQ de la ficha.</p>
<h2>Fuego lento, maíz y carta propia</h2>
<p>La entrevista sale publicada para que el visitante vea revista de verdad: un local con fotos, horarios y una carta que no copia Buenos Aires. En el mismo recorte del centro, <a href="/commerce/${pena.id}">Peña El Cardón</a> sostiene la mesa compartida y el <a href="/commerce/${teatro.id}">Teatro Victoria</a> abre la sala a la noche.</p>
<blockquote>El locro se explica. Si hay gluten, se dice. Si el patio cierra a la una, también.</blockquote>
<p>${folklore ? `El próximo sábado, <a href="/event/${folklore.id}">Noche de Folklore en La Casona</a> junta tres conjuntos y empanadas de cortesía.` : 'El próximo sábado la Casona junta folklore y empanadas de cortesía.'} Si vas a comer, abrí la ficha: ahí está el mapa, el teléfono y lo que el dueño quiere que sepas antes de salir.</p>
`.trim();

  // Artículos: create-only por slug (sin update de content)
  await ensure(
    'article',
    { slug: 'resurgir-noche-salta' },
    {
      title: 'El resurgir de la noche en Salta',
      subtitle: 'Peñas, bares del centro y una agenda que ya no se improvisa.',
      content: nocheHtml,
      slug: 'resurgir-noche-salta',
      coverImage: img('article-noche.png'),
      status: 'PUBLISHED',
      categoryId: catNews.id,
      authorId: admin.id,
      authorName: admin.name,
      isActive: true
    }
  );
  await ensure(
    'article',
    { slug: 'entrevista-chef-local' },
    {
      title: 'Entrevista: los secretos de un chef local',
      subtitle: 'Fuego lento, maíz y una carta que no copia Buenos Aires.',
      content: chefHtml,
      slug: 'entrevista-chef-local',
      coverImage: img('article-chef.png'),
      status: 'PUBLISHED',
      categoryId: catInterviews.id,
      authorId: admin.id,
      authorName: admin.name,
      isActive: true
    }
  );
  await ensure(
    'article',
    { slug: 'agenda-teatro-victoria' },
    {
      title: 'Agenda: tres estrenos en el Victoria',
      subtitle: 'Drama, danza y una función accesible.',
      content: 'Borrador interno. El admin lo deja en DRAFT para probar el listado de magazine.',
      slug: 'agenda-teatro-victoria',
      coverImage: img('teatro-cover.png'),
      status: 'DRAFT',
      categoryId: catAgenda.id,
      authorId: admin.id,
      authorName: admin.name,
      isActive: true
    }
  );

  const adDefs = [
    {
      title: 'Descubrí Salta de noche',
      description: 'Peñas, casonas y el centro caminable.',
      imageUrl: img('banner-home.png'),
      link: '/commerces',
      category: 'SPONSOR',
      position: 'banner_home',
      isActive: true,
      startDate: days(-2),
      endDate: days(40)
    },
    {
      title: 'Agenda cultural de la semana',
      description: 'Teatro, folklore y almuerzos criollos.',
      imageUrl: img('banner-events.png'),
      link: '/events',
      category: 'EXTERNAL',
      position: 'banner_events',
      isActive: true,
      startDate: days(-1),
      endDate: days(20)
    },
    {
      title: 'La Casona destacada',
      description: 'Patio colonial y locro de sábado.',
      imageUrl: img('la-casona-cover.png'),
      link: `/commerce/${casona.id}`,
      category: 'COMMERCE',
      position: 'featured_commerce',
      isActive: true,
      startDate: days(-1),
      endDate: days(25),
      commerceId: casona.id
    }
  ];
  for (const ad of adDefs) {
    await ensure('advertisement', { title: ad.title }, ad);
  }

  const submissionDefs = [
    {
      type: 'CONTACT',
      name: 'Ana Socio',
      email: 'ana@example.com',
      phone: '3874111000',
      message: 'Quiero saber cómo cargar un comercio de mi barrio.',
      status: 'PENDING',
      userId: user.id
    },
    {
      type: 'AD_PROPOSAL',
      name: 'Agencia Norte',
      email: 'diego@example.com',
      message: 'Propuesta de banner 15 días en home.',
      status: 'PENDING',
      attachmentUrl: img('banner-home.png')
    },
    {
      type: 'MAGAZINE_PROPOSAL',
      name: 'Lucía Casona',
      email: 'lucia@example.com',
      message: 'Nota sobre el locro de invierno.',
      status: 'PENDING',
      userId: owner.id
    },
    {
      type: 'PLAN_UPGRADE',
      name: 'Martín Peña',
      email: 'martin@example.com',
      message: 'Quiero pasar Café del Cerro de Free a Plata.',
      status: 'PENDING',
      userId: owner2.id,
      attachmentUrl: img('banner-home.png')
    }
  ];
  for (const s of submissionDefs) {
    await ensure('submission', { email: s.email, type: s.type }, s);
  }

  const folkloreEvent = await prisma.event.findFirst({
    where: { name: 'Noche de Folklore en La Casona' }
  });
  const publishedArticle = await prisma.article.findUnique({
    where: { slug: 'resurgir-noche-salta' }
  });

  const favDefs = [
    { userId: user.id, resourceType: 'commerce', resourceId: casona.id },
    ...(folkloreEvent
      ? [{ userId: user.id, resourceType: 'event', resourceId: folkloreEvent.id }]
      : []),
    { userId: user2.id, resourceType: 'commerce', resourceId: cafe.id },
    ...(publishedArticle
      ? [{ userId: user2.id, resourceType: 'article', resourceId: publishedArticle.id }]
      : [])
  ];
  for (const f of favDefs) {
    await ensure(
      'favorite',
      { userId: f.userId, resourceType: f.resourceType, resourceId: f.resourceId },
      f
    );
  }

  const notifDefs = [
    {
      userId: admin.id,
      type: 'NEW_COMMERCE_REQUEST',
      message: 'Empanadas 9 de Julio espera validación.',
      referenceId: empanadas.id,
      isRead: false
    },
    {
      userId: owner.id,
      type: 'COMMERCE_VALIDATED',
      message: 'La Casona de Salta está ACTIVE y destacada.',
      referenceId: casona.id,
      isRead: true
    },
    {
      userId: owner2.id,
      type: 'NEW_COMMERCE_REQUEST',
      message: 'Tu ficha Empanadas 9 de Julio sigue PENDING.',
      referenceId: empanadas.id,
      isRead: false
    }
  ];
  for (const n of notifDefs) {
    await ensure(
      'notification',
      { userId: n.userId, type: n.type, referenceId: n.referenceId, message: n.message },
      n
    );
  }

  await ensure(
    'newsletterSubscription',
    { email: 'ana@example.com' },
    { email: 'ana@example.com', userId: user.id, active: true }
  );
  await ensure(
    'newsletterSubscription',
    { email: 'visitante@example.com' },
    { email: 'visitante@example.com', active: true }
  );

  await ensure('searchQuery', { term: 'empanadas' }, { term: 'empanadas', count: 18 });
  await ensure('searchQuery', { term: 'peña folklore' }, { term: 'peña folklore', count: 9 });

  const modDefs = [
    {
      resourceType: 'COMMERCE',
      resourceId: casona.id,
      status: 'APPROVED',
      analyzedText: '[DEMO] La Casona de Salta — ficha oro aprobada por filtro + Groq.',
      basicFilterResult: { blocked: false },
      aiResult: { status: 'APPROVED' }
    },
    {
      resourceType: 'COMMERCE',
      resourceId: empanadas.id,
      status: 'FLAGGED',
      analyzedText:
        '[DEMO] Empanadas 9 de Julio — alta nueva, revisar fotos y teléfono antes de ACTIVAR.',
      basicFilterResult: { blocked: false },
      aiResult: { status: 'FLAGGED', reason: 'Alta reciente con comprobante genérico' }
    },
    {
      resourceType: 'COMMENT',
      resourceId: null,
      status: 'REJECTED',
      analyzedText: '[DEMO] comentario con palabra estafa bloqueado por filtro básico.',
      basicFilterResult: { blocked: true, details: 'estafa' },
      aiResult: null
    }
  ];
  for (const m of modDefs) {
    const existing = await prisma.moderationLog.findFirst({
      where: { analyzedText: m.analyzedText }
    });
    if (!existing) await prisma.moderationLog.create({ data: m });
  }

  console.log('[seed] Demo add-only completado (imágenes /seed/).');
  console.log(`[seed] Cuentas demo nuevas (si se crearon): pass = ${DEMO_PASSWORD}`);
  console.log('[seed] jnserrudo / nprueba: NO modificados (usan su password actual).');
}

async function main() {
  console.log(`[seed-prod-demo] DB host: ${getDatabaseHost()}`);

  if (!fs.existsSync(SEED_DIR)) {
    console.warn(`[seed-prod-demo] AVISO: no existe ${SEED_DIR}. Las URLs /seed/... fallarán en el front.`);
  } else {
    const files = fs.readdirSync(SEED_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    console.log(`[seed-prod-demo] public/seed OK (${files.length} imágenes).`);
  }

  await wipeNonKeepers();
  await seedAddOnly();
  console.log('[seed-prod-demo] Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
