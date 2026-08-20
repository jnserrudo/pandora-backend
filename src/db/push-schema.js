import 'dotenv/config';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { assertMutableDatabase } from './databaseTarget.js';

assertMutableDatabase();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
    stdio: 'inherit',
    shell: true,
    cwd: backendRoot,
});

process.exit(result.status ?? 1);
