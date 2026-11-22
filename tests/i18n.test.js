const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const en = readJson('public/i18n/en.json');
const es = readJson('public/i18n/es.json');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'public/js/chat.js'), 'utf8');

assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), 'English and Spanish keys must match');
const placeholders = value => [...String(value).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
for (const key of Object.keys(en)) {
  assert.deepEqual(placeholders(en[key]), placeholders(es[key]), `Placeholder mismatch for ${key}`);
}

const refs = new Set();
for (const match of html.matchAll(/data-i18n(?:-aria|-alt)?="([^"]+)"/g)) refs.add(match[1]);
for (const match of `${app}\n${chat}`.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
  if (!match[1].endsWith('_') && !['l', 'tip'].includes(match[1])) refs.add(match[1]);
}
for (const grade of ['a', 'b', 'c', 'd']) refs.add(`gr_${grade}`);
for (const state of ['done', 'now', 'next']) refs.add(`st_${state}`);
for (let i = 1; i <= 7; i++) { refs.add(`l${i}t`); refs.add(`l${i}d`); refs.add(`tip${i}`); }
for (const area of ['save', 'run', 'debt', 'bal', 'inv']) {
  refs.add(`q_${area}_q`); refs.add(`sc_${area}`);
  for (const rating of ['0', '50', '100']) refs.add(`q_${area}_${rating}`);
}
for (const id of ['numbers', 'deficit', 'starter', 'debt', 'reserve', 'goals', 'invest', 'maintain']) {
  refs.add(`plan_${id}`); refs.add(`plan_${id}_d`);
}
for (const category of ['housing', 'food', 'transport', 'utilities', 'health', 'debts', 'savings', 'investments', 'unexpected', 'fun', 'shopping', 'other']) refs.add(`cat_${category}`);

for (const [lang, dictionary] of [['en', en], ['es', es]]) {
  const missing = [...refs].filter(key => !(key in dictionary));
  assert.deepEqual(missing, [], `${lang} is missing translations: ${missing.join(', ')}`);
}

console.log(`i18n tests passed (${Object.keys(en).length} matched English/Spanish entries)`);
