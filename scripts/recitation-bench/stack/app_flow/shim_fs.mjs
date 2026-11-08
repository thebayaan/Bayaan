/* eslint-env node, es2020 */
import fs from 'node:fs';
export const readAsStringAsync = async file => fs.readFileSync(file, 'utf8');
