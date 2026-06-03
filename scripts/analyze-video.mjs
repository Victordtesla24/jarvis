#!/usr/bin/env node
// analyze-video.mjs — reference-video analysis for the JARVIS dashboard design work.
//
// Downloads a YouTube reference clip, samples frames at the timestamps that matter,
// and asks an OpenRouter vision model to break down the animation + visual language
// so the dashboard can be matched to it. Pure tooling — never imported by the app.
//
// Usage:
//   node scripts/analyze-video.mjs <youtube-url> --ts 46,57,70,75,91 [--label main-ref] [--model google/gemini-2.0-flash-001]
//
// The OpenRouter key is read from ~/.claude/.env.production (OPENROUTER_API_KEY).
// Requires `yt-dlp` and `ffmpeg` on PATH. Frames + report land in .video-analysis/.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const WORK = join(ROOT, '.video-analysis');

function readEnvKey(name) {
  const envPath = join(homedir(), '.claude', '.env.production');
  if (!existsSync(envPath)) throw new Error(`env file not found: ${envPath}`);
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
  }
  throw new Error(`${name} not present in ${envPath}`);
}

function parseArgs(argv) {
  const args = { ts: [], label: 'ref', model: 'google/gemini-2.5-flash', url: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ts') args.ts = argv[++i].split(',').map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n));
    else if (a === '--label') args.label = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (!a.startsWith('--')) args.url = a;
  }
  if (!args.url) throw new Error('usage: node scripts/analyze-video.mjs <youtube-url> --ts 46,57,70 [--label x] [--model id]');
  if (!args.ts.length) throw new Error('provide --ts with at least one timestamp (seconds)');
  return args;
}

function downloadVideo(url, label) {
  const out = join(WORK, `${label}.mp4`);
  if (existsSync(out)) return out;
  console.error(`↓ downloading ${url} → ${out}`);
  execFileSync('yt-dlp', ['-f', 'bestvideo[height<=720][ext=mp4]/best[height<=720]', '-o', out, url], { stdio: 'inherit' });
  return out;
}

function extractFrame(video, ts, label) {
  const dir = join(WORK, 'frames');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${label}_t${ts}.jpg`);
  if (!existsSync(out)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(ts), '-i', video, '-frames:v', '1', '-q:v', '3', out, '-y']);
  }
  return out;
}

async function analyze(key, model, frames, url) {
  const content = [
    { type: 'text', text:
      'You are a senior motion/FUI designer. These are frames from a sci-fi "JARVIS / Iron Man" ' +
      'holographic HUD reference video (' + url + '), in timestamp order. For EACH frame describe, ' +
      'concretely enough to rebuild in React-Three-Fiber + Canvas/SVG:\n' +
      '1. Layout & components (panels, gauges, charts, the central element).\n' +
      '2. The exact colour palette (hex-ish) and which colour dominates.\n' +
      '3. The ANIMATION on screen (what moves, how fast, easing, loops, reveals).\n' +
      '4. The single highest-impact detail that makes it read as "expensive".\n' +
      'Then end with a 5-bullet "MATCH CHECKLIST" of the most important things to replicate.' },
    ...frames.map((f) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${readFileSync(f).toString('base64')}` } })),
  ];
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0.2, max_tokens: 4096 }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? JSON.stringify(json, null, 2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(WORK, { recursive: true });
  const key = readEnvKey('OPENROUTER_API_KEY');
  const video = downloadVideo(args.url, args.label);
  const frames = args.ts.map((ts) => extractFrame(video, ts, args.label));
  console.error(`◆ analysing ${frames.length} frames via ${args.model} …`);
  const report = await analyze(key, args.model, frames, args.url);
  const md = `# Reference analysis — ${args.url}\n\nModel: ${args.model}\nFrames: ${args.ts.map((t) => `${t}s`).join(', ')}\n\n${report}\n`;
  const outPath = join(WORK, `${args.label}.analysis.md`);
  writeFileSync(outPath, md);
  console.error(`✓ wrote ${outPath}`);
  process.stdout.write(report + '\n');
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
