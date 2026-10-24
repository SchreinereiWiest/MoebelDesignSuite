export type TenantRole = "admin" | "manager" | "user" | "public";

export type AuthTenant = {
  id: string;
  name: string;
  slug: string;
  status?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  login: string;
  role: TenantRole;
  tenant: AuthTenant;
  provider: "carpenters" | "public";
};

export type SuiteLicense = {
  licenseId: string | null;
  tenantId: string;
  companyName: string;
  status: "active" | "inactive" | "expired" | "suspended" | "revoked" | "missing";
  plan: string | null;
  features: string[];
  maxUsers: number | null;
  validUntil: string | null;
  lastCheckedAt: string;
};

export type AuthContext = {
  user: AuthUser;
  license?: SuiteLicense;
};

export function permissionsFor(role: TenantRole, features: string[] = [], isGlobalTagCurator = false) {
  const licensed = new Set(features);
  return {
    useDesign: true,
    usePublicContent: licensed.has("public-content"),
    useMoodboards: licensed.has("moodboards"),
    uploadImages: licensed.has("public-content") && (role === "admin" || role === "manager"),
    manageOwnTenantImages: role === "admin" || role === "manager",
    manageCompanySettings: role === "admin",
    proposeTags: role === "admin",
    curateGlobalTags: isGlobalTagCurator,
    viewLicense: role === "admin" || role === "manager",
    manageLicense: role === "admin",
  };
}
