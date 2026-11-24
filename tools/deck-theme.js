// Writes the deck's theme colours and fonts into ppt/theme/theme*.xml after pptxgenjs has saved the file.
// Used by tools/session-deck.js when no APPLY_THEME script is given. Needs jszip (installed with pptxgenjs).
const fs = require('fs');
const JSZip = require('jszip');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ORDER = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

async function applyTheme(file, T) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files).filter(n => /^ppt\/theme\/theme\d+\.xml$/.test(n));
  const clr = `<a:clrScheme name="${esc(T.name)}">${ORDER.map(k => `<a:${k}><a:srgbClr val="${T.colors[k]}"/></a:${k}>`).join('')}</a:clrScheme>`;
  for (const n of names) {
    let x = await zip.file(n).async('string');
    x = x.replace(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/, clr)
      .replace(/(<a:majorFont>\s*<a:latin typeface=")[^"]*"/, `$1${esc(T.headFontFace)}"`)
      .replace(/(<a:minorFont>\s*<a:latin typeface=")[^"]*"/, `$1${esc(T.bodyFontFace)}"`)
      .replace(/(<a:fontScheme name=")[^"]*"/, `$1${esc(T.name)}"`)
      .replace(/(<a:theme [^>]*name=")[^"]*"/, `$1${esc(T.name)}"`);
    zip.file(n, x);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
module.exports = { applyTheme };
