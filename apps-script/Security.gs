function stableStringify_(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify_).join(',') + ']';
  return '{' + Object.keys(value).sort().map(function(key) { return JSON.stringify(key) + ':' + stableStringify_(value[key]); }).join(',') + '}';
}
function base64Url_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function sha256_(text) { return base64Url_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)); }
function hmac_(text, secret) { return base64Url_(Utilities.computeHmacSha256Signature(text, secret, Utilities.Charset.UTF_8)); }
function secureEqual_(left, right) {
  left = String(left || ''); right = String(right || ''); if (left.length !== right.length) return false;
  var difference = 0; for (var i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i); return difference === 0;
}
function verifySignedEnvelope_(envelope) {
  if (!envelope || typeof envelope !== 'object') throw appError_('INVALID_JSON', 'Envelope permintaan tidak valid.');
  var secret = props_().getProperty(APP.PROPERTY_KEYS.HMAC_SECRET);
  if (!secret) throw appError_('CONFIGURATION', 'HMAC_SECRET belum dikonfigurasi.');
  var timestamp = Number(envelope.timestamp);
  if (!timestamp || Math.abs(Date.now() - timestamp) > APP.MAX_CLOCK_SKEW_MS) throw appError_('STALE_REQUEST', 'Permintaan sudah kedaluwarsa.');
  var calculatedHash = sha256_(stableStringify_(envelope.payload));
  if (!secureEqual_(calculatedHash, envelope.payloadHash)) throw appError_('INVALID_SIGNATURE', 'Hash payload tidak valid.');
  var canonical = [timestamp, envelope.nonce, envelope.requestId, envelope.action, envelope.payloadHash].join('|');
  if (!secureEqual_(hmac_(canonical, secret), envelope.signature)) throw appError_('INVALID_SIGNATURE', 'Tanda tangan permintaan tidak valid.');
  var cache = CacheService.getScriptCache();
  var nonceKey = 'nonce:' + envelope.nonce;
  if (cache.get(nonceKey)) throw appError_('REPLAY', 'Permintaan duplikat ditolak.');
  cache.put(nonceKey, '1', 600);
  return envelope;
}
