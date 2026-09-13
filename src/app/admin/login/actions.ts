"use server";

import { AuthError } from "next-auth";
import { signIn } from "../../../../auth";

export type AdminLoginActionState = {
  message?: string;
};

export async function adminLoginAction(
  _previousState: AdminLoginActionState,
  formData: FormData
): Promise<AdminLoginActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Credenziali non valide" };
    }

    throw error;
  }

  return {};
}
