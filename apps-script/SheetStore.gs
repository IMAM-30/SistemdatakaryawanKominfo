function sheet_(name) {
  var sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw appError_('SCHEMA', 'Sheet ' + name + ' belum tersedia. Jalankan setupProject().');
  return sheet;
}
function headers_(name) { return APP.TABLES[name]; }
function rows_(name) {
  var sheet = sheet_(name), headers = headers_(name), lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues().map(function(values, index) {
    var row = { _row: index + 2 }; headers.forEach(function(header, i) { row[header] = values[i]; }); return row;
  });
}
function append_(name, object) {
  var headers = headers_(name); sheet_(name).appendRow(headers.map(function(header) { return object[header] === undefined ? '' : sanitizeCell_(object[header]); })); return object;
}
function replaceRow_(name, rowNumber, object) {
  var headers = headers_(name); sheet_(name).getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(header) { return object[header] === undefined ? '' : sanitizeCell_(object[header]); })]); return object;
}
function findOne_(name, predicate) { var rows = rows_(name); for (var i = 0; i < rows.length; i++) if (predicate(rows[i])) return rows[i]; return null; }
function stripRow_(row) { if (!row) return row; var copy = {}; Object.keys(row).forEach(function(key) { if (key !== '_row') copy[key] = row[key]; }); return copy; }
function activeRows_(name) { return rows_(name).filter(function(row) { return !row.deletedAt; }).map(stripRow_); }
function updateVersioned_(name, id, expectedVersion, patch, actor) {
  var row = findOne_(name, function(item) { return String(item.id) === String(id); });
  if (!row || row.deletedAt) throw appError_('NOT_FOUND', 'Data tidak ditemukan.');
  if (expectedVersion !== undefined && Number(row.version) !== Number(expectedVersion)) throw appError_('VERSION_CONFLICT', 'Data telah diubah pengguna lain. Muat ulang sebelum menyimpan.');
  Object.keys(patch).forEach(function(key) { if (headers_(name).indexOf(key) !== -1) row[key] = patch[key]; });
  row.version = Number(row.version || 0) + 1; row.updatedAt = nowIso_(); row.updatedBy = actor.accountId;
  replaceRow_(name, row._row, row); return stripRow_(row);
}
function softDelete_(name, id, expectedVersion, actor) { return updateVersioned_(name, id, expectedVersion, { deletedAt: nowIso_(), deletedBy: actor.accountId, active: false }, actor); }
function restore_(name, id, expectedVersion, actor) {
  var row = findOne_(name, function(item) { return String(item.id) === String(id); });
  if (!row) throw appError_('NOT_FOUND', 'Data tidak ditemukan.');
  if (expectedVersion !== undefined && Number(row.version) !== Number(expectedVersion)) throw appError_('VERSION_CONFLICT', 'Versi data tidak cocok.');
  row.deletedAt = ''; row.deletedBy = ''; row.active = true; row.version = Number(row.version || 0) + 1; row.updatedAt = nowIso_(); row.updatedBy = actor.accountId;
  replaceRow_(name, row._row, row); return stripRow_(row);
}
function withLock_(callback) { var lock = LockService.getScriptLock(); lock.waitLock(30000); try { return callback(); } finally { lock.releaseLock(); } }
