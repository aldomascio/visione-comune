import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateAdminWithPassword } from "@/modules/admin/application/admin-authentication";
import { DrizzleAdminUserRepository } from "@/modules/admin/infrastructure/drizzle-admin-user-repository";
import { createDatabaseConnection } from "@/shared/db/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "admin";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/admin/login"
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = typeof credentials.email === "string" ? credentials.email : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        let connection;

        try {
          connection = createDatabaseConnection();
          const adminUser = await authenticateAdminWithPassword({
            email,
            password,
            adminUserRepository: new DrizzleAdminUserRepository(connection.db)
          });

          if (!adminUser) {
            return null;
          }

          return {
            id: adminUser.id,
            email: adminUser.email,
            role: adminUser.role
          };
        } finally {
          await connection?.close();
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        (token as { role?: "admin" }).role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      const role = (token as { role?: "admin" }).role;

      if (session.user && token.sub && token.email && role === "admin") {
        session.user.id = token.sub;
        session.user.email = token.email;
        session.user.role = role;
      }

      return session;
    }
  }
});
