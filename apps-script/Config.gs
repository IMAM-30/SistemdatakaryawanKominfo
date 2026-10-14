var APP = Object.freeze({
  API_VERSION: '1.0.0',
  SCHEMA_VERSION: '2',
  TIMEZONE: 'Asia/Makassar',
  MAX_CLOCK_SKEW_MS: 5 * 60 * 1000,
  MAX_PHOTO_BYTES: 2 * 1024 * 1024,
  PROPERTY_KEYS: { SPREADSHEET_ID: 'SPREADSHEET_ID', DRIVE_FOLDER_ID: 'DRIVE_FOLDER_ID', HMAC_SECRET: 'HMAC_SECRET', BOOTSTRAP_SECRET: 'BOOTSTRAP_SECRET' },
  TABLES: {
    META: ['key', 'value', 'updatedAt'],
    SETTINGS: ['key', 'value', 'updatedAt', 'updatedBy'],
    CATEGORIES: ['id', 'code', 'name', 'description', 'active', 'sortOrder', 'version', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'],
    FIELDS: ['id', 'categoryId', 'key', 'label', 'type', 'required', 'optionsJson', 'tableVisible', 'publicVisible', 'portalVisible', 'adminVisible', 'sortOrder', 'active', 'system', 'version', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'],
    EMPLOYEES: ['id', 'categoryId', 'dataJson', 'photoFileId', 'active', 'version', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'],
    ACCOUNTS: ['id', 'username', 'displayName', 'role', 'passwordHash', 'passwordEncrypted', 'active', 'version', 'lastLoginAt', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'],
    SESSIONS: ['id', 'accountId', 'tokenHash', 'csrfHash', 'expiresAt', 'createdAt', 'lastSeenAt', 'revokedAt'],
    FILES: ['id', 'employeeId', 'driveFileId', 'name', 'mimeType', 'size', 'checksum', 'state', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy'],
    AUDIT_LOGS: ['id', 'actorId', 'actorRole', 'action', 'entityType', 'entityId', 'summaryJson', 'createdAt'],
    IDEMPOTENCY: ['requestId', 'action', 'payloadHash', 'resultJson', 'createdAt', 'expiresAt'],
    RATE_LIMITS: ['key', 'windowStartedAt', 'count', 'updatedAt']
  }
});

var INITIAL_CATEGORIES = [
  { code: 'PNS', name: 'Pegawai Negeri Sipil', description: 'Data Pegawai Negeri Sipil', sortOrder: 1 },
  { code: 'PPPK', name: 'Pegawai Pemerintah dengan Perjanjian Kerja', description: 'Data PPPK', sortOrder: 2 },
  { code: 'NON_PNS', name: 'Non Pegawai Negeri Sipil', description: 'Data pegawai Non-PNS', sortOrder: 3 }
];

var INITIAL_FIELDS = {
  PNS: [
    ['photo', 'Foto', 'photo'], ['nip', 'NIP', 'text'], ['name', 'Nama', 'text'], ['birthPlace', 'Tempat Lahir (Kabupaten/Kota)', 'text'],
    ['birthDate', 'Tanggal Lahir', 'date'], ['gender', 'Jenis Kelamin', 'select'], ['religion', 'Agama', 'select'], ['addressCity', 'Alamat Kota/Kabupaten', 'text'],
    ['cpnsRank', 'Golongan/Pangkat CPNS', 'text'], ['cpnsRankTmt', 'TMT Golongan/Pangkat CPNS', 'date'], ['position', 'Jabatan', 'text'],
    ['echelon', 'Eselon', 'text'], ['echelonTmt', 'TMT Eselon', 'date'], ['latestRank', 'Golongan/Pangkat (Terakhir)', 'text'],
    ['latestRankTmt', 'TMT Golongan/Pangkat (Terakhir)', 'date'], ['kgb', 'KGB', 'date'], ['nextKgb', 'KGB Berikutnya', 'date'],
    ['serviceYears', 'Masa Kerja Tahun', 'number'], ['serviceMonths', 'Masa Kerja Bulan', 'number'], ['lastEducation', 'Pendidikan Terakhir', 'text'],
    ['educationMajor', 'Jurusan Pendidikan Terakhir', 'text']
  ],
  PPPK: [['photo', 'Foto', 'photo'], ['name', 'Nama', 'text'], ['nip', 'NIP', 'text'], ['position', 'Jabatan', 'text'], ['addressCity', 'Alamat Kota/Kabupaten', 'text']],
  NON_PNS: [['photo', 'Foto', 'photo'], ['name', 'Nama', 'text'], ['position', 'Jabatan', 'text'], ['addressCity', 'Alamat Kota/Kabupaten', 'text']]
};
