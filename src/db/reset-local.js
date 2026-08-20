import 'dotenv/config';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { assertLocalDatabaseForReset } from './databaseTarget.js';

assertLocalDatabaseForReset();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function run(command, args) {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        shell: true,
        cwd: backendRoot,
    });
    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1);
    }
}

run('docker', ['compose', 'down', '-v']);
run('docker', ['compose', 'up', '-d', '--wait']);
run('npx', ['prisma', 'db', 'push', '--skip-generate']);
run('node', ['src/db/seed.js']);
