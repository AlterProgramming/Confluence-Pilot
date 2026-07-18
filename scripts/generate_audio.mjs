import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env.local');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'audio');
const API_BASE = 'https://api.elevenlabs.io';

const MUSIC_PROMPT = [
  'Instrumental ambient music loop for the Confluence room pilot, 90 seconds.',
  'Mood: calm wonder, intelligent exhibition space, slow spatial breath, refined and cinematic but restrained.',
  'Harmony: F minor center with gentle Bb major suspended color, deep 58 Hz/87 Hz drone relationship, soft overtones, no vocals.',
  'Texture: warm low synth drone, airy granular shimmer, distant glass harmonics, very slow filter motion, wide stereo reverb.',
  'Structure: sparse opening, gradual textural bloom, subtle transition pulse, return to an imperceptible loop point.',
  'Avoid drums, pop song structure, lead melody, lyrics, harsh impacts, busy arpeggios.',
].join(' ');

const SOUND_EFFECTS = [
  {
    name: 'transition-forward',
    duration_seconds: 4,
    loop: false,
    prompt_influence: 0.52,
    text: 'A refined sci-fi gallery transition whoosh: soft filtered air pressure rising upward, glassy shimmer, subtle low-frequency sweep, no explosion, no harsh transient, designed for moving forward through a vertical room conduit.',
  },
  {
    name: 'transition-back',
    duration_seconds: 4,
    loop: false,
    prompt_influence: 0.52,
    text: 'A refined sci-fi gallery transition whoosh in reverse direction: airy filtered descent, low resonant sweep falling gently, distant glass harmonics, no explosion, no harsh transient, designed for moving backward through a vertical room conduit.',
  },
  {
    name: 'room-arrival-chime',
    duration_seconds: 3,
    loop: false,
    prompt_influence: 0.48,
    text: 'A delicate arrival chime for an immersive AI exhibition room: one soft sine-like bell, warm sub resonance, brief crystalline tail, spacious reverb, elegant and understated.',
  },
  {
    name: 'ambient-room-bed',
    duration_seconds: 30,
    loop: true,
    prompt_influence: 0.42,
    text: 'Seamless looping ambient room tone for an AI exhibition gallery: deep warm drone, faint air movement, subtle electrical life, glassy harmonic shimmer, very slow modulation, no melody, no beat, no voices.',
  },
];

function parseDotEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

async function loadApiKey() {
  const fromEnv = process.env.ELEVENLABS_API_KEY;
  if (fromEnv && fromEnv !== 'your_elevenlabs_api_key_here') return fromEnv;
  if (!existsSync(ENV_PATH)) {
    throw new Error(`Missing ${ENV_PATH}; set ELEVENLABS_API_KEY before generating audio.`);
  }
  const env = parseDotEnv(await readFile(ENV_PATH, 'utf8'));
  const key = env.ELEVENLABS_API_KEY;
  if (!key || key === 'your_elevenlabs_api_key_here') {
    throw new Error('ELEVENLABS_API_KEY is missing or still set to the placeholder.');
  }
  return key;
}

async function postAudio(endpoint, body, outputPath, apiKey, outputFormat) {
  const url = new URL(endpoint, API_BASE);
  if (outputFormat) url.searchParams.set('output_format', outputFormat);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${endpoint} failed (${response.status}): ${text.slice(0, 1000)}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
  return {
    output: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
    bytes: bytes.length,
    contentType: response.headers.get('content-type'),
    songId: response.headers.get('song-id'),
    characterCost: response.headers.get('character-cost'),
  };
}

async function generateMusic(apiKey) {
  const outputPath = path.join(OUT_DIR, 'confluence-ambient-main.mp3');
  return postAudio(
    '/v1/music',
    {
      prompt: MUSIC_PROMPT,
      music_length_ms: 90_000,
      model_id: 'music_v2',
      force_instrumental: true,
      sign_with_c2pa: false,
    },
    outputPath,
    apiKey,
    'mp3_48000_192',
  );
}

async function generateSoundEffect(effect, apiKey) {
  const outputPath = path.join(OUT_DIR, `${effect.name}.mp3`);
  return postAudio(
    '/v1/sound-generation',
    {
      text: effect.text,
      duration_seconds: effect.duration_seconds,
      loop: effect.loop,
      prompt_influence: effect.prompt_influence,
      model_id: 'eleven_text_to_sound_v2',
    },
    outputPath,
    apiKey,
    'mp3_44100_128',
  );
}

async function main() {
  const only = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('--')));
  const skipMusic = process.argv.includes('--skip-music');
  const skipSfx = process.argv.includes('--skip-sfx');
  const apiKey = await loadApiKey();
  await mkdir(OUT_DIR, { recursive: true });

  const generated = [];
  if (!skipMusic && (only.size === 0 || only.has('music'))) {
    console.log('Generating ambient music...');
    generated.push({ type: 'music', name: 'confluence-ambient-main', ...(await generateMusic(apiKey)) });
  }

  if (!skipSfx) {
    for (const effect of SOUND_EFFECTS) {
      if (only.size > 0 && !only.has(effect.name) && !only.has('sfx')) continue;
      console.log(`Generating sound effect: ${effect.name}...`);
      generated.push({ type: 'sound-effect', name: effect.name, ...(await generateSoundEffect(effect, apiKey)) });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    provider: 'elevenlabs',
    sources: {
      trackList: 'docs/audio-tracklist.md',
      studyGuide: 'docs/music-composition-study.md',
      engine: 'src/lib/audioEngine.ts',
    },
    assets: generated,
    prompts: {
      music: MUSIC_PROMPT,
      soundEffects: SOUND_EFFECTS,
    },
  };
  const manifestPath = path.join(OUT_DIR, 'audio-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, manifestPath).replaceAll(path.sep, '/')}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
