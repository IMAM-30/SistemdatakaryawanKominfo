function doGet() { return output_(success_({ status: 'ok', service: 'Sistem Data Karyawan Kominfo Parepare', apiVersion: APP.API_VERSION })); }
function doPost(e) {
  try {
    var envelope=verifySignedEnvelope_(JSON.parse(e.postData.contents));
    var mutation=isMutationAction_(envelope.action);
    // Writes and login rate limits must always re-read current rows for validation.
    beginSheetRequest_(!mutation && envelope.action !== 'auth.lookup');
    ensureCurrentSchema_();
    if(mutation){
      var existing=findOne_('IDEMPOTENCY',function(row){return row.requestId===envelope.requestId&&new Date(row.expiresAt).getTime()>Date.now();});
      if(existing){if(existing.action!==envelope.action||existing.payloadHash!==envelope.payloadHash)throw appError_('CONFLICT','Request ID telah digunakan untuk payload berbeda.');return output_(success_(parseJson_(existing.resultJson,{})));}
    }
    var result=route_(envelope.action,envelope.payload||{});
    if(mutation)append_('IDEMPOTENCY',{requestId:envelope.requestId,action:envelope.action,payloadHash:envelope.payloadHash,resultJson:JSON.stringify(result),createdAt:nowIso_(),expiresAt:new Date(Date.now()+24*60*60*1000).toISOString()});
    return output_(success_(result));
  }
  catch(error){ console.error(error && error.stack ? error.stack : error); return output_(failure_(error)); }
  finally { endSheetRequest_(); }
}
function isMutationAction_(action){return ['health','dashboard.snapshot','auth.lookup','auth.sessionGet','auth.csrfVerify','settings.public','settings.get','categories.publicList','categories.list','fields.publicList','fields.list','employees.publicList','employees.publicGet','employees.list','employees.get','files.publicGet','files.get','accounts.listActiveAdmins','accounts.listAdmins','accounts.listPortal','audit.list','export.snapshot'].indexOf(action)===-1;}
