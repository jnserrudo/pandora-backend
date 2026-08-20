const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function getDatabaseHost(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl) {
        throw new Error('DATABASE_URL no está definida.');
    }

    const withoutProtocol = databaseUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const at = withoutProtocol.lastIndexOf('@');
    const hostPortDb = at === -1 ? withoutProtocol : withoutProtocol.slice(at + 1);
    const hostPort = hostPortDb.split('/')[0];

    if (hostPort.startsWith('[')) {
        const end = hostPort.indexOf(']');
        return hostPort.slice(1, end).toLowerCase();
    }

    return hostPort.split(':')[0].toLowerCase();
}

export function isLocalDatabase(databaseUrl = process.env.DATABASE_URL) {
    return LOCAL_HOSTS.has(getDatabaseHost(databaseUrl));
}

export function assertMutableDatabase() {
    if (isLocalDatabase()) return;

    if (process.env.ALLOW_REMOTE_DB === 'true') {
        console.warn(`[DB] ALLOW_REMOTE_DB=true — vas a escribir en ${getDatabaseHost()} (no es localhost).`);
        return;
    }

    console.error(
        `[DB] DATABASE_URL apunta a ${getDatabaseHost()}, no a localhost.\n` +
        'Seed y db push contra el VPS están bloqueados. Para forzarlos: ALLOW_REMOTE_DB=true'
    );
    process.exit(1);
}

export function assertLocalDatabaseForReset() {
    if (isLocalDatabase()) return;

    console.error(
        `[DB] db:reset está prohibido contra ${getDatabaseHost()}. ` +
        'Aunque ALLOW_REMOTE_DB=true, no se resetea el MySQL del VPS.'
    );
    process.exit(1);
}

export function warnIfRemoteStudio() {
    if (isLocalDatabase()) return;
    console.warn(`[DB] Prisma Studio va a abrir ${getDatabaseHost()} — no es la DB local.`);
}
