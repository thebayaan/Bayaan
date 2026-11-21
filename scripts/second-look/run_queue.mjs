/* eslint-env node, es2020 */
// Runs a list of commands, a fixed number at a time, one ONNX thread each with the arena off.
// A command that exits 75 hit its memory limit and starts again; it resumes where it stopped.
//   node scripts/second-look/run_queue.mjs <workers> <log file> <jobs.json>
// jobs.json: a list of argument lists for node. Stops only what it started.
import {spawn} from 'node:child_process';
import fs from 'node:fs';

const [workers, logFile, jobsFile] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const log = fs.createWriteStream(logFile, {flags: 'a'});
const say = line => log.write(`${new Date().toISOString()} ${line}\n`);
let next = 0;
let failed = 0;
const children = new Set();
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    for (const c of children) c.kill(signal);
    process.exit(1);
  });
}
const once = args =>
  new Promise(resolve => {
    const p = spawn('nice', ['-n', '5', 'node', ...args], {
      env: {...process.env, ORT_THREADS: '1', ORT_ARENA: '0'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(p);
    p.stdout.on('data', d => log.write(d));
    p.stderr.on('data', d => {
      const text = String(d);
      if (
        !text.includes('Reparsing as ES module') &&
        !text.includes('"type": "module"') &&
        !text.includes('--trace-warnings')
      )
        log.write(text);
    });
    p.on('close', code => {
      children.delete(p);
      resolve(code);
    });
  });
async function worker() {
  while (next < jobs.length) {
    const args = jobs[next++];
    say(`start ${args.join(' ')}`);
    let code = await once(args);
    while (code === 75) code = await once(args);
    say(`end ${code} ${args.join(' ')}`);
    if (code !== 0) failed += 1;
  }
}
await Promise.all(Array.from({length: Number(workers)}, worker));
say(`queue done, ${failed} failed`);
log.end();
console.log(failed ? `failed ${failed}` : 'finished');
