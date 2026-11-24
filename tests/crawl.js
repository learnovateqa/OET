// Crawl every route as a student and as the teacher, at desktop and phone widths, in light and dark mode.
// Reports page errors, console errors and any sideways scrolling. Uses tests/gas-stub.js as the backend.
// Run: node tests/crawl.js            (screenshots: SHOTS=dir node tests/crawl.js)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { makeGas } = require('./gas-stub');
const ROOT = path.join(__dirname, '..'), FAKE = 'https://script.google.com/macros/s/TEST/exec', PASS = 'secret1';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.pptx': 'application/octet-stream' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('not found') }
      let body = fs.readFileSync(f);
      if (p === '/index.html') body = body.toString().replace('PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE', FAKE);
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); rsp.end(body);
    }).listen(0, () => res(srv));
  });
}

async function main() {
  const gas = makeGas(); gas.props.TEACHER_PASSWORD = PASS;
  const b = gas.call('teacher.batch.save', { pass: PASS, batch: { name: 'December Evening Batch', start: '2026-12-01', schedule: 'Sun & Wed · 7–9 pm' } });
  gas.call('teacher.student.save', { pass: PASS, student: { code: 'OET-TEST1', name: 'Asha Nair', email: 'asha@example.com', phone: '+974 5555 0101', batch: b.batch.id } });
  gas.call('teacher.send', { pass: PASS, to: { code: 'OET-TEST1' }, kind: 'message', subject: 'Welcome', body: 'Welcome to the course!' });
  gas.call('student.send', { code: 'OET-TEST1', body: 'Hello Ms. Maria, a question about Session 2.' });
  const srv = await serve(); const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const problems = [], shots = process.env.SHOTS;
  const VIEWS = [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]];
  for (const [vname, vp] of VIEWS) for (const scheme of ['light', 'dark']) for (const who of ['student', 'teacher']) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
    await ctx.route(FAKE, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(gas.handle(r.request().postData())) }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|learnovateqa\.github\.io/, r => r.fulfill({ body: '' }));
    const page = await ctx.newPage(); let where = '';
    page.on('pageerror', e => problems.push(`${vname}/${scheme}/${who} ${where}: PAGE ERROR ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`${vname}/${scheme}/${who} ${where}: CONSOLE ${m.text()}`) });
    page.on('dialog', d => d.accept());
    await page.goto(base);
    if (who === 'student') { await page.fill('#login-code', 'OET-TEST1'); await page.click('#login-btn'); }
    else { await page.goto(base + '#teacher'); await page.fill('#tlogin-pass', PASS); await page.click('#tlogin-btn'); }
    await page.waitForTimeout(600);
    const routes = await page.evaluate(() => ['#home', '#syllabus', '#mocks', '#log', '#messages', '#templates', '#teacher']
      .concat(SESSIONS.map(s => '#session-' + s.n)).concat(Object.keys(MOCKS).flatMap(id => ['L', 'R', 'W', 'S', 'report'].map(k => `#mock-${id}-${k}`))));
    for (const r of routes) {
      where = r;
      for (const tab of (r.startsWith('#session-') ? ['live', 'hub'] : [null])) {
        await page.goto(base + r); await page.waitForTimeout(250);
        if (tab) { await page.click(`[data-tab="${tab}"]`).catch(() => {}); await page.evaluate(() => { const g = document.getElementById('gate-open'); if (g) g.click(); document.querySelectorAll('details').forEach(d => d.open = true); document.querySelectorAll('.stephost .tool.closed .step-head').forEach(h => h.click()) }); await page.waitForTimeout(250); }
        if (who === 'teacher' && r === '#teacher') { await page.click('tr[data-stu]').catch(() => {}); await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); }
        const over = await page.evaluate(() => { const W = document.documentElement.clientWidth; if (document.documentElement.scrollWidth <= W + 1) return null;
          const bad = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 1 && !e.closest('.tablewrap,.mk-text,pre,.deck') }).slice(0, 4)
            .map(e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : '') + ' ' + Math.round(e.getBoundingClientRect().right));
          return document.documentElement.scrollWidth + ' > ' + W + ' · ' + bad.join(' | ') });
        const junk = await page.evaluate(() => { const m = document.body.innerText.match(/.{0,40}(\bNaN\b|\bundefined\b|\[object Object\]).{0,40}/); return m ? m[0] : null });
        if (junk) problems.push(`${vname}/${scheme}/${who} ${r}${tab ? ' (' + tab + ')' : ''}: BAD TEXT "${junk}"`);
        if (over) problems.push(`${vname}/${scheme}/${who} ${r}${tab ? ' (' + tab + ')' : ''}: SIDEWAYS SCROLL ${over}`);
        if (shots && scheme === 'light' && (r === '#home' || r === '#teacher' || r === '#session-1')) {
          fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${who}-${vname}-${r.slice(1)}${tab ? '-' + tab : ''}.png`), fullPage: true });
        }
      }
    }
    await ctx.close();
  }
  await browser.close(); srv.close();
  const uniq = [...new Set(problems)];
  console.log(uniq.length ? uniq.join('\n') : 'No problems found.');
  process.exitCode = uniq.length ? 1 : 0;
}
main().catch(e => { console.error(e); process.exit(2) });
