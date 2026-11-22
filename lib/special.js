// "Special %": compares a user's survey profile against the Nemotron-Personas-El-Salvador sample.
const fs = require('fs');

const CLOSED = ['sex', 'area', 'education_level', 'household_type', 'marital_status', 'languages_spoken', 'department', 'municipality'];
const OPTIONS = {
  sex: ['Masculino', 'Femenino'],
  area: ['rural', 'urbano'],
  education_level: ['ninguno', 'primaria', 'secundaria', 'bachillerato', 'tecnico', 'universitario', 'posgrado'],
  household_type: ['unipersonal', 'pareja', 'nuclear', 'extendido', 'monoparental'],
  marital_status: ['soltero', 'casado', 'union_libre', 'divorciado', 'separado', 'viudo'],
  languages_spoken: ['español', 'español e inglés', 'español y otro idioma']
};
// How much each answered question counts toward the similarity score (0-1 per question, weighted average).
// Only the 9 fields above count (8 closed questions + age). occupation and career_goals_and_ambitions are deliberately NOT part of the score; they are only shown and summarised.
const WEIGHTS = { sex: 1, area: 1, education_level: 1.5, household_type: 1, marital_status: 1, languages_spoken: 0.5, department: 1, municipality: 1, age: 2 };
const AGE_SPAN = 20;          // years apart at which the age similarity reaches 0
const SIMILAR_THRESHOLD = 0.75; // a persona "looks like you" at or above this score
const MIN_ANSWERED = 5;       // closed questions (+ age) required to compute anything
const STOP = new Set('de la el en y a los las un una con por para que su sus se al del lo como mas pero sin sobre entre tambien the and for with that this from have not'.split(' '));

const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
const tokens = s => [...new Set(norm(s).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.slice(0, 5)))];

// Streams CSV rows to a callback (quoted fields, "" escapes) so the whole file is never held as an array of rows.
function parseCsv(text, onRow) {
  let row = [], start = 0, quoted = false, buf = '';
  const push = end => { row.push(buf + text.slice(start, end)); buf = ''; };
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (quoted) {
      if (c === 34) { if (text.charCodeAt(i + 1) === 34) { buf += text.slice(start, i + 1); i++; start = i + 1; } else { buf += text.slice(start, i); quoted = false; start = i + 1; } }
    } else if (c === 34) { buf += text.slice(start, i); quoted = true; start = i + 1; }
    else if (c === 44) { push(i); start = i + 1; }
    else if (c === 10) { push(i > start && text.charCodeAt(i - 1) === 13 ? i - 1 : i); onRow(row); row = []; start = i + 1; }
  }
  if (start < text.length || row.length || buf) { push(text.length); onRow(row); }
}

function loadDataset(file) {
  const text = fs.readFileSync(file, 'utf8'), people = [], pool = new Map(), intern = v => { let x = pool.get(v); if (x === undefined) { pool.set(v, v); x = v; } return x; };
  let col = null;
  parseCsv(text, r => {
    if (!col) {
      col = Object.fromEntries(r.map((h, i) => [h.trim(), i]));
      for (const k of [...CLOSED, 'age', 'occupation', 'career_goals_and_ambitions']) if (!(k in col)) throw new Error('missing column ' + k);
      return;
    }
    if (r.length < Object.keys(col).length) return;
    const p = {}; for (const k of CLOSED) p[k] = intern(r[col[k]]);
    p.age = Number.parseInt(r[col.age], 10); p.occupation = intern(r[col.occupation]);
    p.career_goals_and_ambitions = r[col.career_goals_and_ambitions];
    people.push(p);
  });
  return { people, size: people.length };
}

// Validates and normalises a profile coming from the client; returns { profile, answered }.
function cleanProfile(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, profile = {};
  for (const [k, list] of Object.entries(OPTIONS)) profile[k] = list.includes(src[k]) ? src[k] : '';
  profile.department = typeof src.department === 'string' ? src.department.slice(0, 40) : '';
  profile.municipality = typeof src.municipality === 'string' ? src.municipality.slice(0, 60) : '';
  const age = Number.parseInt(src.age, 10); profile.age = Number.isInteger(age) && age >= 0 && age <= 120 ? age : '';
  profile.occupation = typeof src.occupation === 'string' ? src.occupation.trim().slice(0, 200) : '';
  profile.career_goals_and_ambitions = typeof src.career_goals_and_ambitions === 'string' ? src.career_goals_and_ambitions.trim().slice(0, 1000) : '';
  const answered = [...CLOSED, 'age'].filter(k => profile[k] !== '').length;
  return { profile, answered };
}

function scorer(profile) {
  return p => {
    let sum = 0, w = 0; const add = (k, s) => { sum += WEIGHTS[k] * s; w += WEIGHTS[k]; };
    for (const k of CLOSED) if (profile[k] !== '') add(k, p[k] === profile[k] ? 1 : 0);
    if (profile.age !== '') add('age', Number.isFinite(p.age) ? Math.max(0, 1 - Math.abs(p.age - profile.age) / AGE_SPAN) : 0);
    return w ? sum / w : 0;
  };
}

const view = (p, score) => ({ sex: p.sex, age: p.age, area: p.area, education_level: p.education_level, household_type: p.household_type, marital_status: p.marital_status, languages_spoken: p.languages_spoken, department: p.department, municipality: p.municipality, occupation: p.occupation, career_goals_and_ambitions: p.career_goals_and_ambitions, score: Math.round(score * 1000) / 10 });

function analyze(ds, rawProfile, n = 5) {
  const { profile, answered } = cleanProfile(rawProfile);
  if (answered < MIN_ANSWERED) return { ok: false, error: 'not_enough_answers', answered, min: MIN_ANSWERED };
  if (!ds.size) return { ok: false, error: 'empty_dataset' };
  const score = scorer(profile), ageGap = p => profile.age !== '' && Number.isFinite(p.age) ? Math.abs(p.age - profile.age) : 0;
  const closedAnswered = CLOSED.filter(k => profile[k] !== '');
  let similar = 0, exact = 0; const top = [], bottom = [];
  const better = (a, b) => a.s > b.s || (a.s === b.s && a.g < b.g), worse = (a, b) => a.s < b.s || (a.s === b.s && a.g > b.g);
  const keep = (list, cand, beats) => { let i = list.length; while (i > 0 && beats(cand, list[i - 1])) i--; if (i < n) { list.splice(i, 0, cand); if (list.length > n) list.pop(); } };
  for (const p of ds.people) {
    const s = score(p), cand = { p, s, g: ageGap(p) };
    if (s >= SIMILAR_THRESHOLD) similar++;
    if (closedAnswered.length && closedAnswered.every(k => p[k] === profile[k])) exact++;
    keep(top, cand, better); keep(bottom, cand, worse);
  }
  const pct = x => Math.round((x / ds.size) * 10000) / 100;
  return { ok: true, total: ds.size, answered, threshold: SIMILAR_THRESHOLD * 100, similarCount: similar, similarPct: pct(similar), specialPct: Math.round((100 - (similar / ds.size) * 100) * 100) / 100, exactCount: exact, exactPct: pct(exact),
    top: top.map(c => view(c.p, c.s)), bottom: bottom.map(c => view(c.p, c.s)), profile };
}

module.exports = { loadDataset, analyze, cleanProfile, parseCsv, CLOSED, OPTIONS, MIN_ANSWERED, SIMILAR_THRESHOLD };
