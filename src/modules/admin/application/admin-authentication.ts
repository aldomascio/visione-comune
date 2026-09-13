import type { PublicAdminSessionUser, AdminUserRepository } from "./admin-user-repository";
import { normalizeAdminEmail, toPublicAdminSessionUser } from "./admin-user-repository";
import { verifyPassword } from "./password-hashing";

export async function authenticateAdminWithPassword(input: {
  email: string;
  password: string;
  adminUserRepository: AdminUserRepository;
}): Promise<PublicAdminSessionUser | null> {
  const email = normalizeAdminEmail(input.email);

  if (!email || !input.password) {
    return null;
  }

  const adminUser = await input.adminUserRepository.findByEmail(email);

  if (!adminUser || !adminUser.active) {
    return null;
  }

  const passwordMatches = await verifyPassword(input.password, adminUser.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return toPublicAdminSessionUser(adminUser);
}
