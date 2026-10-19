function rateLimit_(key, limit, windowSeconds) {
  var now = Date.now(), row = findOne_('RATE_LIMITS', function(item) { return item.key === key; });
  if (!row || now - new Date(row.windowStartedAt).getTime() > windowSeconds * 1000) {
    var next = { key: key, windowStartedAt: nowIso_(), count: 1, updatedAt: nowIso_() };
    if (row) replaceRow_('RATE_LIMITS', row._row, next); else append_('RATE_LIMITS', next); return;
  }
  if (Number(row.count) >= limit) throw appError_('RATE_LIMITED', 'Terlalu banyak percobaan. Silakan coba kembali nanti.');
  row.count = Number(row.count) + 1; row.updatedAt = nowIso_(); replaceRow_('RATE_LIMITS', row._row, row);
}
function authLookup_(payload) {
  var username = requireText_(payload.username, 'ID pengguna', 3, 64).toLowerCase(); rateLimit_('login:' + username, 15, 900);
  var row = findOne_('ACCOUNTS', function(item) { return String(item.username).toLowerCase() === username && !item.deletedAt; });
  if (!row) throw appError_('INVALID_CREDENTIALS', 'ID atau password tidak sesuai.');
  return { id: row.id, username: row.username, displayName: row.displayName, role: row.role, profilePhotoFileId: row.profilePhotoFileId || '', passwordHash: row.passwordHash, active: bool_(row.active) };
}
function bootstrapMaster_(payload) {
  var expected = props_().getProperty(APP.PROPERTY_KEYS.BOOTSTRAP_SECRET);
  if (!expected || !secureEqual_(payload.bootstrapSecret, expected)) throw appError_('FORBIDDEN', 'Bootstrap tidak diizinkan.');
  if (findOne_('ACCOUNTS', function(row) { return row.role === 'MASTER_ADMIN' && !row.deletedAt; })) throw appError_('CONFLICT', 'Admin Master sudah tersedia.');
  return withLock_(function() {
    var now = nowIso_(), account = { id: uuid_(), username: requireText_(payload.username, 'ID pengguna', 3, 64).toLowerCase(), displayName: requireText_(payload.displayName, 'Nama', 2, 100), role: 'MASTER_ADMIN', passwordHash: requireText_(payload.passwordHash, 'Hash password', 20, 1000), passwordEncrypted: requireText_(payload.passwordEncrypted, 'Password terenkripsi', 20, 1000), active: true, version: 1, lastLoginAt: '', createdAt: now, createdBy: 'BOOTSTRAP', updatedAt: now, updatedBy: 'BOOTSTRAP', deletedAt: '', deletedBy: '' };
    append_('ACCOUNTS', account); audit_(null, 'accounts.bootstrapMaster', 'ACCOUNT', account.id, auditSummary_('@'+account.username,{},account,{username:'Username',displayName:'Nama akun',role:'Hak akses',active:'Status aktif'},['username','displayName','role','active'])); return { id: account.id, username: account.username };
  });
}
function sessionCreate_(payload) {
  var account = findOne_('ACCOUNTS', function(row) { return row.id === payload.accountId && !row.deletedAt && bool_(row.active); });
  if (!account) throw appError_('UNAUTHENTICATED', 'Akun tidak aktif.');
  return withLock_(function() {
    var now = nowIso_(), session = { id: uuid_(), accountId: account.id, tokenHash: requireText_(payload.tokenHash, 'Token', 20, 200), csrfHash: requireText_(payload.csrfHash, 'CSRF', 20, 200), expiresAt: new Date(Date.now() + Math.min(Number(payload.expiresInSeconds || 28800), 28800) * 1000).toISOString(), createdAt: now, lastSeenAt: now, revokedAt: '' };
    append_('SESSIONS', session); account.lastLoginAt = now; replaceRow_('ACCOUNTS', account._row, account); return { created: true };
  });
}
function sessionGet_(payload) {
  var session = findOne_('SESSIONS', function(row) { return row.tokenHash === payload.tokenHash && !row.revokedAt; });
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) throw appError_('SESSION_EXPIRED', 'Sesi telah berakhir.');
  var account = findOne_('ACCOUNTS', function(row) { return row.id === session.accountId && !row.deletedAt && bool_(row.active); });
  if (!account) throw appError_('UNAUTHENTICATED', 'Akun tidak aktif.');
  return { accountId: account.id, username: account.username, displayName: account.displayName, role: account.role, profilePhotoFileId: account.profilePhotoFileId || '' };
}
function csrfVerify_(payload) {
  var session = findOne_('SESSIONS', function(row) { return row.accountId === payload.accountId && row.csrfHash === payload.csrfHash && !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now(); });
  if (!session) throw appError_('FORBIDDEN', 'Token CSRF tidak valid.'); return { valid: true };
}
function sessionDelete_(payload) {
  var session = findOne_('SESSIONS', function(row) { return row.tokenHash === payload.tokenHash && !row.revokedAt; });
  if (session) { session.revokedAt = nowIso_(); replaceRow_('SESSIONS', session._row, session); } return { deleted: true };
}
function revokeAccountSessions_(accountId) { rows_('SESSIONS').forEach(function(row) { if (row.accountId === accountId && !row.revokedAt) { row.revokedAt = nowIso_(); replaceRow_('SESSIONS', row._row, row); } }); }
