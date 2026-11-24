// Stand-in for Google Apps Script: runs apps-script/Code.gs in Node with in-memory fakes of
// SpreadsheetApp, PropertiesService, LockService, MailApp, DriveApp and friends. Used by the Playwright tests.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
function makeGas() {
  const sheets = {}, props = {}, mail = [], files = [];
  const sheetObj = name => {
    const rows = sheets[name];
    const api = {
      getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
      appendRow: vals => { rows.push(vals.slice()) },
      getRange: (r, c, nr, nc) => ({
        setValues: v => { rows[r - 1] = rows[r - 1] || []; v[0].forEach((x, i) => rows[r - 1][c - 1 + i] = x) },
        setValue: v => { rows[r - 1] = rows[r - 1] || []; rows[r - 1][c - 1] = v },
        setNumberFormat: () => {}
      }),
      deleteRow: r => { rows.splice(r - 1, 1) },
      setFrozenRows: () => {}
    };
    return api;
  };
  const ss = { getSheetByName: n => sheets[n] ? sheetObj(n) : null, insertSheet: n => { sheets[n] = []; return sheetObj(n) } };
  const folder = name => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: n => folder(n),
    createFile: blob => { files.push(blob); return { getUrl: () => 'https://drive.google.com/fake/' + files.length, getId: () => 'F' + files.length } } });
  const ctx = {
    console, JSON, Date, Math, Object, Array, String, Number, RegExp, Error, encodeURIComponent,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('no ui') } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] == null ? null : props[k], setProperty: (k, v) => { props[k] = String(v) }, deleteProperty: k => { delete props[k] } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ text: s }) }) },
    Utilities: { getUuid: () => crypto.randomUUID(), formatDate: d => new Date(d).toISOString().slice(0, 10), base64Decode: s => Buffer.from(s, 'base64'), newBlob: (b, t, n) => ({ b, t, n }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }), getScriptTimeZone: () => 'UTC' },
    MailApp: { sendEmail: m => { mail.push(m) }, getRemainingDailyQuota: () => 100 },
    DriveApp: { getRootFolder: () => folder('root') },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 500, getContentText: () => '{}' }) }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), ctx);
  ctx.setup();
  return {
    props, sheets, mail, files,
    handle: body => JSON.parse(ctx.doPost({ postData: { contents: body } }).text),
    call: (action, payload) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action }, payload || {})) } }).text)
  };
}
module.exports = { makeGas };
