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
  ok('no page errors', !errs.length); if (errs.length) console.log(errs.join('\n'));
  await browser.close(); srv.close(); console.log(steps.join('\n'));
}
main().catch(e => { console.error(e); process.exit(2) });
