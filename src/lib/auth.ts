import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { isWeakNextAuthSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const SESSION_MAX_AGE = 8 * 60 * 60;
const USER_RECHECK_MS = 60_000;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        if (process.env.NODE_ENV === "production" && isWeakNextAuthSecret()) {
          return null;
        }
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.active || !(await compare(parsed.data.password, user.passwordHash))) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lastChecked = Date.now();
        return token;
      }

      if (!token.id) return null as never;

      const lastChecked = typeof token.lastChecked === "number" ? token.lastChecked : 0;
      if (Date.now() - lastChecked < USER_RECHECK_MS) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { active: true, role: true, name: true, email: true },
      });
      if (!dbUser?.active) return null as never;

      token.role = dbUser.role;
      token.name = dbUser.name;
      token.email = dbUser.email;
      token.lastChecked = Date.now();
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            entity: "User",
            entityId: user.id,
          },
        });
      } catch {
        // Login must still succeed if audit writing fails.
      }
    },
  },
};
