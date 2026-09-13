export type AdminRole = "admin";

export type AdminUser = {
  id: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicAdminSessionUser = {
  id: string;
  email: string;
  role: AdminRole;
};

export class DuplicateAdminEmailError extends Error {
  constructor(email: string) {
    super(`Admin user already exists for email: ${email}`);
    this.name = "DuplicateAdminEmailError";
  }
}

export type CreateAdminUserInput = {
  email: string;
  passwordHash: string;
  role?: AdminRole;
  active?: boolean;
};

export type AdminUserRepository = {
  findByEmail(email: string): Promise<AdminUser | null>;
  findActiveById(adminUserId: string): Promise<AdminUser | null>;
  create(input: CreateAdminUserInput): Promise<AdminUser>;
};

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicAdminSessionUser(adminUser: AdminUser): PublicAdminSessionUser {
  return {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role
  };
}
