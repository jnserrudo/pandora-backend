const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    console.log("Intentando contar logs de auditoría...");
    const count = await prisma.auditLog.count();
    console.log("Conteo exitoso:", count);
  } catch (error) {
    console.error("Error al acceder a AuditLog:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
