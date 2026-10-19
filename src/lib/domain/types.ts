export const ROLES = ["MASTER_ADMIN", "KOMINFO_ADMIN", "PORTAL"] as const;
export type Role = (typeof ROLES)[number];

export const PORTAL_MODES = ["PUBLIC", "LOGIN_REQUIRED", "CLOSED"] as const;
export type PortalMode = (typeof PORTAL_MODES)[number];

export interface SessionActor {
  accountId: string;
  username: string;
  displayName: string;
  role: Role;
  profilePhotoFileId?: string;
}
