import { compare } from "bcryptjs";
import type { Role } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { isWeakNextAuthSecret } from "@/lib/env";
import { PIN_LOCK_AFTER, PIN_LOCK_MS, pinSchema } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

const passwordLoginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const pinByUsernameSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  pin: pinSchema,
});

const pinByUserIdSchema = z.object({
  userId: z.string().cuid(),
  pin: pinSchema,
});

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const USER_RECHECK_MS = 60_000;

function sessionUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  pinHash: string | null;
  mustChangePin: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    mustChangePin: user.mustChangePin,
    hasPin: Boolean(user.pinHash),
  };
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: 24 * 60 * 60,
  },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Staff PIN",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        username: { label: "Staff", type: "text" },
        userId: { label: "Staff ID", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(rawCredentials) {
        if (process.env.NODE_ENV === "production" && isWeakNextAuthSecret()) {
          return null;
        }

        const pinByUsername = pinByUsernameSchema.safeParse(rawCredentials);
        const pinByUserId = pinByUserIdSchema.safeParse(rawCredentials);
        if (pinByUsername.success || pinByUserId.success) {
          const pin = pinByUsername.success ? pinByUsername.data.pin : pinByUserId.data!.pin;
          const user = pinByUsername.success
            ? await prisma.user.findUnique({ where: { username: pinByUsername.data.username } })
            : await prisma.user.findUnique({ where: { id: pinByUserId.data!.userId } });
          if (!user?.active || !user.pinHash) return null;
          if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
            await writeAudit(user, { action: "LOGIN_LOCKED", entity: "User", entityId: user.id });
            return null;
          }

          const ok = await compare(pin, user.pinHash);
          if (!ok) {
            const attempts = user.pinFailedAttempts + 1;
            const lockedUntil = attempts >= PIN_LOCK_AFTER ? new Date(Date.now() + PIN_LOCK_MS) : null;
            await prisma.user.update({
              where: { id: user.id },
              data: { pinFailedAttempts: attempts, pinLockedUntil: lockedUntil },
            });
            await writeAudit(user, {
              action: "LOGIN_FAILED",
              entity: "User",
              entityId: user.id,
              details: { attempts },
            });
            return null;
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { pinFailedAttempts: 0, pinLockedUntil: null, lastLoginAt: new Date() },
          });
          return sessionUser(user);
        }

        const parsed = passwordLoginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.active || !(await compare(parsed.data.password, user.passwordHash))) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        return sessionUser(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.mustChangePin = user.mustChangePin;
        token.hasPin = user.hasPin;
        token.lastChecked = Date.now();
        return token;
      }

      if (!token.id) return null as never;

      const lastChecked = typeof token.lastChecked === "number" ? token.lastChecked : 0;
      if (Date.now() - lastChecked < USER_RECHECK_MS) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: {
          active: true,
          role: true,
          name: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          pinHash: true,
          mustChangePin: true,
        },
      });
      if (!dbUser?.active) return null as never;

      token.role = dbUser.role;
      token.name = dbUser.name;
      token.email = dbUser.email;
      token.username = dbUser.username;
      token.firstName = dbUser.firstName;
      token.lastName = dbUser.lastName;
      token.mustChangePin = dbUser.mustChangePin;
      token.hasPin = Boolean(dbUser.pinHash);
      token.lastChecked = Date.now();
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.username = token.username ?? "";
        session.user.firstName = token.firstName ?? "";
        session.user.lastName = token.lastName ?? "";
        session.user.name = token.name ?? session.user.name;
        session.user.mustChangePin = Boolean(token.mustChangePin);
        session.user.hasPin = Boolean(token.hasPin);
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        await writeAudit(
          {
            id: user.id,
            username: user.username ?? "",
            name: user.name ?? "",
            role: user.role,
          },
          { action: "LOGIN", entity: "User", entityId: user.id },
        );
      } catch {
        // Login must still succeed if audit writing fails.
      }
    },
  },
};
