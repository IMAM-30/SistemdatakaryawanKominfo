function nowIso_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function uuid_() { return Utilities.getUuid(); }
function props_() { return PropertiesService.getScriptProperties(); }
function spreadsheet_() {
  var id = props_().getProperty(APP.PROPERTY_KEYS.SPREADSHEET_ID);
  if (!id) throw appError_('CONFIGURATION', 'SPREADSHEET_ID belum dikonfigurasi.');
  return SpreadsheetApp.openById(id);
}
function appError_(code, message, details) { var error = new Error(message); error.appCode = code; error.details = details || null; return error; }
function success_(data) { return { ok: true, data: data, meta: { apiVersion: APP.API_VERSION, generatedAt: nowIso_() } }; }
function failure_(error) {
  return { ok: false, error: { code: error.appCode || 'INTERNAL', message: error.appCode ? error.message : 'Terjadi kesalahan internal.', details: error.details || null }, meta: { apiVersion: APP.API_VERSION, generatedAt: nowIso_() } };
}
function output_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
function parseJson_(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (error) { return fallback; } }
function bool_(value) { return value === true || String(value).toLowerCase() === 'true'; }
function sanitizeCell_(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}
function cleanObject_(value) {
  if (Array.isArray(value)) return value.map(cleanObject_);
  if (!value || typeof value !== 'object') return sanitizeCell_(value);
  var result = {}; Object.keys(value).forEach(function(key) { result[key] = cleanObject_(value[key]); }); return result;
}
function requireText_(value, label, min, max) {
  var text = String(value == null ? '' : value).trim();
  if (text.length < (min || 1) || text.length > (max || 500)) throw appError_('VALIDATION', label + ' tidak valid.');
  return sanitizeCell_(text);
}
function requireActor_(payload, roles) {
  var actor = payload && payload.actor;
  if (!actor || roles.indexOf(actor.role) === -1) throw appError_('FORBIDDEN', 'Akun tidak memiliki izin.');
  return actor;
}
function safeSummary_(payload, keys) {
  var summary = {}; (keys || []).forEach(function(key) { if (payload[key] !== undefined && key.toLowerCase().indexOf('password') === -1) summary[key] = payload[key]; }); return summary;
}
