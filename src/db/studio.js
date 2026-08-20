import 'dotenv/config';
import { spawnSync } from 'child_process';
import { warnIfRemoteStudio } from './databaseTarget.js';

warnIfRemoteStudio();

const result = spawnSync('npx', ['prisma', 'studio'], {
    stdio: 'inherit',
    shell: true,
});

process.exit(result.status ?? 1);
