function audit_(actor, action, entityType, entityId, summary) {
  append_('AUDIT_LOGS', { id: uuid_(), actorId: actor ? actor.accountId : 'SYSTEM', actorRole: actor ? actor.role : 'SYSTEM', action: action, entityType: entityType, entityId: entityId || '', summaryJson: JSON.stringify(cleanObject_(summary || {})), createdAt: nowIso_() });
}
function listAudit_(payload) {
  requireActor_(payload, ['MASTER_ADMIN', 'KOMINFO_ADMIN']);
  var limit = Math.min(Math.max(Number(payload.limit || 100), 1), 500);
  return { items: activeRows_('AUDIT_LOGS').slice(-limit).reverse().map(function(row) { row.summary = parseJson_(row.summaryJson, {}); delete row.summaryJson; return row; }) };
}
