const assert = require('node:assert/strict');
const path = require('node:path');
const { loadDataset, analyze, cleanProfile, parseCsv } = require('../lib/special');

const rows = []; parseCsv('a,b\r\n1,"x, ""y"""\n2,z', r => rows.push(r));
assert.deepEqual(rows, [['a', 'b'], ['1', 'x, "y"'], ['2', 'z']], 'CSV parser handles quotes, escapes and CRLF');

const ds = loadDataset(path.join(__dirname, 'fixtures', 'personas.csv'));
assert.equal(ds.size, 6);
assert.match(ds.people[0].career_goals_and_ambitions, /"mucho"/);

const me = { sex: 'Masculino', age: 30, area: 'urbano', education_level: 'bachillerato', household_type: 'nuclear', marital_status: 'union_libre', languages_spoken: 'español', department: 'Ahuachapán', municipality: 'Ahuachapán Sur', occupation: 'agencia de viajes', career_goals_and_ambitions: 'negocio de viajes' };
const r = analyze(ds, me, 2);
assert.equal(r.ok, true);
assert.equal(r.similarCount, 2, 'the two travel-agency personas look like the user');
assert.equal(r.similarPct, 33.33); assert.equal(r.specialPct, 66.67);
assert.equal(r.exactCount, 2);
assert.equal(r.top.length, 2); assert.equal(r.bottom.length, 2);
assert.ok(r.top[0].score >= r.top[1].score && r.top[0].score > 90);
assert.ok(r.bottom.every(p => p.score < 30), 'the least similar are far away');
assert.ok(['Femenino'].includes(r.bottom[0].sex) && r.bottom[0].age >= 68);
assert.ok(r.top[0].age === 29 || r.top[0].age === 31);

const noGoals = analyze(ds, { ...me, career_goals_and_ambitions: 'xyz totalmente distinto' }, 2);
assert.deepEqual([noGoals.similarCount, noGoals.top.map(p => p.score)], [r.similarCount, r.top.map(p => p.score)], 'career goals must not affect the score');

const noOcc = analyze(ds, { ...me, occupation: 'astronauta' }, 2);
assert.deepEqual([noOcc.similarCount, noOcc.top.map(p => p.score)], [r.similarCount, r.top.map(p => p.score)], 'occupation must not affect the score');

const few = analyze(ds, { sex: 'Masculino', age: 30 });
assert.equal(few.ok, false); assert.equal(few.error, 'not_enough_answers');
const bad = cleanProfile({ sex: 'x', age: '999', department: 5, occupation: ' a '.repeat(200) });
assert.equal(bad.profile.sex, ''); assert.equal(bad.profile.age, ''); assert.equal(bad.profile.department, ''); assert.ok(bad.profile.occupation.length <= 200);
assert.equal(bad.answered, 0);
console.log('special tests passed');
