// Builds the printable PDF templates from downloads/*.html with the pre-installed Chromium.
// Run: node tools/build-templates.js
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const n of ['letter-template', 'roleplay-phrases']) {
    await p.goto('file://' + path.join(__dirname, '..', 'downloads', n + '.html'));
    await p.pdf({ path: path.join(__dirname, '..', 'downloads', n + '.pdf'), format: 'A4', printBackground: true, scale: 0.8, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    console.log('downloads/' + n + '.pdf');
  }
  await b.close();
})();
