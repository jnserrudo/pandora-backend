import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  const articles = await prisma.article.count();
  const events = await prisma.event.count();
  const commerces = await prisma.commerce.count();
  const activeArticles = await prisma.article.count({ where: { isActive: true } });
  const activeEvents = await prisma.event.count({ where: { isActive: true } });
  const activeCommerces = await prisma.commerce.count({ where: { isActive: true } });

  console.log('--- DB STATS ---');
  console.log('Total Articles:', articles, '(Active:', activeArticles + ')');
  console.log('Total Events:', events, '(Active:', activeEvents + ')');
  console.log('Total Commerces:', commerces, '(Active:', activeCommerces + ')');
  
  // Check first few commerces to see their status
  const someCommerces = await prisma.commerce.findMany({ take: 5 });
  console.log('Sample Commerces:', JSON.stringify(someCommerces, null, 2));

  await prisma.$disconnect();
}

checkData();
