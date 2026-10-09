export interface BayaanAuthProfile {
  accountId: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface BayaanOpaqueSession {
  token: string;
  expiresAt: number;
  profile: BayaanAuthProfile;
}
