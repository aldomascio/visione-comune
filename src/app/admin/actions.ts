"use server";

import { signOut } from "../../../auth";

export async function adminLogoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
