// backend/src/db/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Roles/Users
  const password = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pandora.com' },
    update: {},
    create: {
      email: 'admin@pandora.com',
      username: 'admin',
      password,
      name: 'Admin Pandora',
      role: 'ADMIN'
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@pandora.com' },
    update: {},
    create: {
      email: 'owner@pandora.com',
      username: 'owner',
      password,
      name: 'Dueño de Local',
      role: 'OWNER'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@pandora.com' },
    update: {},
    create: {
      email: 'user@pandora.com',
      username: 'user',
      password,
      name: 'Usuario Común',
      role: 'USER'
    }
  });

  // 2. Create Article Categories
  const catNews = await prisma.articleCategory.upsert({
    where: { name: 'Noticias' },
    update: {},
    create: { name: 'Noticias', slug: 'noticias' }
  });

  const catInterviews = await prisma.articleCategory.upsert({
    where: { name: 'Entrevistas' },
    update: {},
    create: { name: 'Entrevistas', slug: 'entrevistas' }
  });

  // 3. Create Commerce Categories (Relational Table)
  const categories = [
    { name: 'Vida Nocturna', slug: 'VIDA_NOCTURNA' },
    { name: 'Gastronomía', slug: 'GASTRONOMIA' },
    { name: 'Salas y Teatro', slug: 'SALAS_Y_TEATRO' }
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: `Categoría de tipo ${cat.name}`
      }
    });
  }

  // 4. Create Articles
  await prisma.article.create({
    data: {
      title: 'El resurgir de la noche en Salta',
      subtitle: 'Una mirada a los nuevos locales que están cambiando la escena.',
      content: 'Contenido extenso sobre la vida nocturna...',
      slug: 'resurgir-noche-salta',
      coverImage: 'https://images.unsplash.com/photo-1514525253361-bee8718a7439?q=80&w=1024&auto=format&fit=crop',
      categoryId: catNews.id,
      authorId: admin.id,
      authorName: admin.name,
      isActive: true
    }
  });

  await prisma.article.create({
    data: {
      title: 'Entrevista: Los secretos de un Chef local',
      subtitle: 'Hablamos con Nahuel sobre la fusión de sabores ancestrales.',
      content: 'Contenido de la entrevista...',
      slug: 'entrevista-chef-local',
      coverImage: 'https://images.unsplash.com/photo-1583394838336-acd977730f90?q=80&w=1024&auto=format&fit=crop',
      categoryId: catInterviews.id,
      authorId: admin.id,
      authorName: admin.name,
      isActive: true
    }
  });

  // 4. Create Commerces
  const commerce = await prisma.commerce.create({
    data: {
      name: 'La Casona de Salta',
      description: 'Un lugar tradicional con comida regional y shows en vivo.',
      category: 'GASTRONOMIA',
      address: 'General Güemes 123',
      ownerId: owner.id,
      isActive: true,
      status: 'ACTIVE',
      planLevel: 3,
      galleryImages: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1024&auto=format&fit=crop']
    }
  });

  // 5. Create Events
  await prisma.event.create({
    data: {
      name: 'Noche de Folklore',
      description: 'Ven a disfrutar de los mejores grupos folclóricos.',
      startDate: new Date(),
      endDate: new Date(new Date().getTime() + 4 * 60 * 60 * 1000),
      commerceId: commerce.id,
      isActive: true,
      coverImage: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=1024&auto=format&fit=crop'
    }
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
