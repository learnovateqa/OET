// Functional checks: a student does practice sets, results sync to the stand-in backend, the Error Log tags causes,
// and the teacher sees the student's work. Run: node tests/flows.js   (screenshots: SHOTS=dir node tests/flows.js)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { makeGas } = require('./gas-stub');
const ROOT = path.join(__dirname, '..'), FAKE = 'https://script.google.com/macros/s/TEST/exec', PASS = 'secret1';
const SHOTS = process.env.SHOTS;
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p); if (!fs.existsSync(f)) { rsp.writeHead(404); return rsp.end() }
      let b = fs.readFileSync(f);
      if (p === '/index.html') b = b.toString().replace('PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE', FAKE);
      rsp.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); rsp.end(b);
    }).listen(0, () => res(srv));
  });
}
const steps = [];
const ok = (name, cond) => { steps.push((cond ? '✓ ' : '✗ ') + name); if (!cond) process.exitCode = 1 };
async function newCtx(browser, gas) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  // no speech voices in headless Chromium: the site falls back to showing the transcript once
  await ctx.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }) });
  await ctx.route(FAKE, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(gas.handle(r.request().postData())) }));
  await ctx.route(/fonts\.|learnovateqa\.github\.io/, r => r.fulfill({ body: '' }));
  return ctx;
}
async function openStep(page, base, n, tool) {
  await page.goto(base + '#session-' + n); await page.click('[data-tab="hub"]');
  await page.evaluate(() => { const g = document.getElementById('gate-open'); if (g) g.click() });
  if (await page.$(`#tool-${tool} .tool.closed`)) await page.click(`#tool-${tool} .step-head`);
  await page.click(`#tool-${tool} [data-si-start]`);
}
async function main() {
  const gas = makeGas(); gas.props.TEACHER_PASSWORD = PASS;
  const b = gas.call('teacher.batch.save', { pass: PASS, batch: { name: 'Test batch' } });
  gas.call('teacher.student.save', { pass: PASS, student: { code: 'OET-TEST1', name: 'Asha Nair', batch: b.batch.id } });
  const srv = await serve(); const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch(); const errs = [];
  const ctx = await newCtx(browser, gas); const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(base); await page.fill('#login-code', 'OET-TEST1'); await page.click('#login-btn'); await page.waitForTimeout(500);

  // Listening Part A: all right except a misspelling (Q10) and a blank (Q12)
  await openStep(page, base, 2, 'LA1'); await page.click('#tool-LA1 [data-play]');
  const ans = await page.evaluate(() => QUIZ.LA1.qs.map(x => x.a[0]));
  const gaps = await page.$$('#tool-LA1 input.gap');
  for (let i = 0; i < gaps.length; i++) { if (i === 11) continue; await gaps[i].fill(i === 9 ? 'ibuprofin' : ans[i]) }
  if (SHOTS) await page.locator('#tool-LA1').screenshot({ path: SHOTS + '/LA1-before.png' });
  await page.click('#tool-LA1 [data-submit]'); await page.waitForTimeout(200);
  const la = await page.evaluate(() => results()['2:LA1']); ok('Part A set scored 10/12', la && la.score === 10 && la.total === 12);
  const log = await page.evaluate(() => store.get('log', []));
  ok('misspelled answer tagged “spelling”', log.some(e => e.yours === 'ibuprofin' && e.cause === 'spelling'));
  ok('blank answer tagged “timing”', log.some(e => e.yours === '(no answer)' && e.cause === 'timing'));
  if (SHOTS) await page.locator('#tool-LA1').screenshot({ path: SHOTS + '/LA1-after.png' });

  // Reading Part A: answers typed with different case and an extra article still count
  await openStep(page, base, 4, 'RA1');
  await page.evaluate(() => { const h = document.getElementById('tool-RA1'); QUIZ.RA1.qs.forEach((x, i) => { const n = '4:RA1-q' + i;
    if (x.o) h.querySelector(`select[name="${CSS.escape(n)}"]`).value = String(x.a);
    else h.querySelector(`input[name="${CSS.escape(n)}"]`).value = i === 10 ? 'A Pillow' : x.a[0].toUpperCase() }) });
  if (SHOTS) await page.locator('#tool-RA1').screenshot({ path: SHOTS + '/RA1.png' });
  await page.click('#tool-RA1 [data-submit]');
  const ra = await page.evaluate(() => results()['4:RA1']); ok('Reading Part A accepts case and article differences (20/20)', ra && ra.score === 20);

  // Part B listening set with three extracts: every Play button works once, submit unlocks after the last one
  await openStep(page, base, 3, 'LB1');
  const plays = await page.$$('#tool-LB1 [data-play]'); for (const p of plays) await p.click();
  await page.waitForTimeout(300);
  ok('Part B submit unlocks after all extracts', !(await page.isDisabled('#tool-LB1 [data-submit]')));

  // Drill with radio buttons
  await openStep(page, base, 9, 'D9');
  await page.evaluate(() => document.querySelectorAll('#tool-D9 fieldset').forEach(f => f.querySelector('input').checked = true));
  await page.click('#tool-D9 [data-submit]');
  const d9 = await page.evaluate(() => results()['9:D9']); ok('drill scored and saved', d9 && d9.total === 7);
  const pos = await page.evaluate(() => { const c = [0, 0, 0]; Object.values(QUIZ).forEach(q => q.qs.forEach(x => { if (x.o && x.o.length === 3 && !x.o.every(o => /^[A-H]$/.test(o))) c[x.a]++ })); return c });
  ok(`3-option answers balanced across positions (${pos.join(' / ')})`, Math.max(...pos) - Math.min(...pos) <= 3);

  // Writing: case notes + letter, the checker, the self-check
  page.on('dialog', d => d.accept());
  await openStep(page, base, 7, 'W7'); await page.click('#tool-W7 [data-go]');
  ok('letter is locked during the 5 minutes of reading time', await page.$eval('#tool-W7 textarea', e => e.readOnly));
  await page.click('#tool-W7 .mb-time + button, #tool-W7 button:has-text("Skip to writing")');
  const letter = await page.evaluate(() => { const M = WRITE.W7.model; return M.head.join('\n') + '\n\n' + M.date + '\n\n' + M.re + '\n\n' + M.greet + '\n\n' + M.parts.map(p => p[1]).join('\n\n') + '\n\n' + M.close + '\n\n' + M.sign.join('\n') });
  await page.fill('#tool-W7 textarea', letter);
  const chk = await page.evaluate(t => letterCheck(t, WRITE.W7), letter);
  ok(`letter checker passes the model letter (${chk.words} words, ${chk.warn.length} warnings)`, chk.date && chk.recipient && chk.re && chk.greet && chk.close && chk.purpose && chk.request && chk.words >= 170 && chk.words <= 220 && !chk.warn.length);
  const bad = await page.evaluate(() => letterCheck('Dear Dr Khan,\n\nPt c/o SOB. He’s a heavy smoker and gonna need lots of help.\n\nYours faithfully,\nNurse', WRITE.W7));
  ok('letter checker flags contractions, note form, judgement, informal words and the wrong closing', bad.warn.map(w => w[0]).join('|').match(/Contractions/) && /Note-form/.test(bad.warn.map(w => w[0]).join()) && /Judgemental/.test(bad.warn.map(w => w[0]).join()) && /Informal/.test(bad.warn.map(w => w[0]).join()) && /Closing/.test(bad.warn.map(w => w[0]).join()));
  await page.click('#tool-W7 [data-submit]'); await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelectorAll('#tool-W7 [data-rub]').forEach(s => { s.value = s.dataset.rub === 'purpose' ? '2' : '5' }) });
  await page.click('#tool-W7 [data-saverub]');
  const w7 = await page.evaluate(() => results()['7:W7']); ok(`letter saved with a self-check of ${w7 && w7.est} (2 + five 5s = grade B)`, w7 && w7.text && w7.est === 350);
  ok('model letter and model selection appear after submitting', await page.isVisible('#tool-W7 [data-model] summary'));
  if (SHOTS) await page.locator('#tool-W7').screenshot({ path: SHOTS + '/W7.png' });

  // Case-notes selector: mark every note like the model selection
  await openStep(page, base, 6, 'CN1');
  await page.evaluate(() => { const L = WRITE.W7; document.querySelectorAll('#tool-CN1 [data-cn]').forEach(li => { const [g, i] = li.dataset.cn.split('.').map(Number); li.querySelector(`[data-mk="${L.notes[g].items[i][1] === 0 ? 'x' : 'y'}"]`).click() }) });
  await page.click('#tool-CN1 [data-check]');
  const cn = await page.evaluate(() => results()['6:CN1']); ok(`case-notes selector scored ${cn && cn.score}/${cn && cn.total}`, cn && cn.score === cn.total);
  if (SHOTS) await page.locator('#tool-CN1').screenshot({ path: SHOTS + '/CN1.png' });

  // Speaking: preparation, a short recording (no microphone in the test browser), the nine-criteria self-check
  await page.evaluate(() => { SPEAK.S9A.speak = 2; SPEAK.S9A.cues = [] });
  await openStep(page, base, 9, 'S9A'); await page.click('#tool-S9A [data-go]'); await page.waitForTimeout(500);
  await page.click('#tool-S9A button:has-text("Start the role-play now")'); await page.waitForTimeout(3500);
  ok('role-play finishes and shows the self-check', await page.isVisible('#tool-S9A [data-after]'));
  await page.evaluate(() => document.querySelectorAll('#tool-S9A [data-rub]').forEach(s => { s.value = s.dataset.rub.length && ['intel', 'flu', 'approp', 'gram'].includes(s.dataset.rub) ? '5' : '2' }));
  await page.click('#tool-S9A [data-save]');
  const s9 = await page.evaluate(() => results()['9:S9A']); ok(`role-play self-check saved: ${s9 && s9.est} (5s and 2s = grade B)`, s9 && s9.est === 350);
  if (SHOTS) await page.locator('#tool-S9A').screenshot({ path: SHOTS + '/S9A.png' });

  // Mock 1 Listening: answer the first Part A screen correctly, skip through the rest
  await page.goto(base + '#mock-1-L'); await page.click('#mk-start');
  const mk1 = await page.evaluate(() => MOCKS[1].L[0].qs.map(x => x.a[0]));
  for (let i = 0; i < mk1.length; i++) await page.fill(`input[name="mk-0-${i}"]`, mk1[i]);
  for (let s = 0; s < 10; s++) { await page.click('[data-skip]'); await page.click('[data-next]') }
  const ml = await page.evaluate(() => results()['mock:M1L']);
  ok(`mock Listening saved (${ml && ml.score}/${ml && ml.total})`, ml && ml.total === 42 && ml.score >= 12);
  ok('mock review shows an estimated score and grade', /about \d+ · grade/.test(await page.textContent('#app')));
  // Mock 1 Reading: Part A, then Parts B and C, then finish
  await page.goto(base + '#mock-1-R'); await page.click('#mk-start');
  await page.evaluate(() => { const p = MOCKS[1].R[0]; p.qs.forEach((x, i) => { const n = 'mk-0-' + i; const el = document.querySelector(`[name="${n}"]`);
    if (x.o) { el.value = String(x.a); el.dispatchEvent(new Event('input', { bubbles: true })) } else { el.value = x.a[0]; el.dispatchEvent(new Event('input', { bubbles: true })) } }) });
  await page.click('[data-next]');
  ok('Parts B and C share one timer with navigation', (await page.$$('.mk-nav [data-goto]')).length === 3);
  await page.click('[data-goto="3"]'); await page.click('[data-finish]');
  const mr = await page.evaluate(() => results()['mock:M1R']); ok(`mock Reading saved, Part A counted (${mr && mr.score}/42)`, mr && mr.total === 42 && mr.score >= 20);
  await page.goto(base + '#mock-1-report'); const rep = await page.textContent('#app');
  ok('score report lists Listening and Reading scores with grades', /Listening[\s\S]*\d{2,3}[\s\S]*Reading/.test(rep) && /not an official OET result/.test(rep));
  const mpos = await page.evaluate(() => { const c = [0, 0, 0]; Object.values(MOCKS).forEach(m => ['L', 'R'].forEach(k => m[k].forEach(p => p.qs.forEach(x => { if (x.o && x.o.length === 3 && !x.o.every(o => /^[A-D]$/.test(o))) c[x.a]++ })))); return c });
  ok(`mock 3-option answers balanced (${mpos.join(' / ')})`, Math.max(...mpos) - Math.min(...mpos) <= 3);

  await page.waitForTimeout(2600); // the sync waits 2 s after the last change
  const row = gas.sheets.Progress.find(r => r[0] === 'OET-TEST1'); const saved = row ? JSON.parse(row.slice(2).join('')) : {};
  ok('progress synced to the Sheet', !!(saved.res && saved.res['2:LA1'] && saved.res['4:RA1'] && saved.log.length >= 2));

  // Teacher sees the work and the coaching focus
  const t = await newCtx(browser, gas); const tp = await t.newPage(); tp.on('pageerror', e => errs.push(e.message));
  await tp.goto(base + '#teacher'); await tp.fill('#tlogin-pass', PASS); await tp.click('#tlogin-btn'); await tp.waitForTimeout(800);
  await tp.click('tr[data-stu]'); await tp.waitForTimeout(300);
  const txt = await tp.textContent('#t-detail');
  ok('teacher sees the Error Log with a spelling entry and a coaching focus', /spelling/i.test(txt) && /Coaching focus/.test(txt));
  if (SHOTS) await tp.screenshot({ path: SHOTS + '/teacher-detail.png', fullPage: true });
  // Teacher removes the mock attempt; it stays removed on the student's device and in the Sheet
  tp.on('dialog', d => d.accept());
  await tp.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await tp.click('[data-mr="1"]'); await tp.click('[data-mr-yes="1"]'); await tp.waitForTimeout(500);
  await page.goto(base + '#home'); await page.reload(); await page.waitForTimeout(1200);
  const gone = await page.evaluate(() => !results()['mock:M1L'] && !results()['mock:M1R'] && !store.get('log', []).some(e => e.session === 'Mock 1'));
  ok('removed mock attempt disappears from the student’s device', gone);
  await page.waitForTimeout(2600);
  const row2 = gas.sheets.Progress.find(r => r[0] === 'OET-TEST1'); const saved2 = JSON.parse(row2.slice(2).join(''));
  ok('removed mock attempt stays removed after the student syncs again', !saved2.res['mock:M1L'] && saved2.res['2:LA1']);
  ok('no page errors', !errs.length); if (errs.length) console.log(errs.join('\n'));
  await browser.close(); srv.close(); console.log(steps.join('\n'));
}
main().catch(e => { console.error(e); process.exit(2) });
