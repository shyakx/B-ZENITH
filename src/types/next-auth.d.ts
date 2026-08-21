import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    username?: string;
    firstName?: string;
    lastName?: string;
    mustChangePin?: boolean;
    hasPin?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      username: string;
      firstName: string;
      lastName: string;
      mustChangePin: boolean;
      hasPin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    username?: string;
    firstName?: string;
    lastName?: string;
    mustChangePin?: boolean;
    hasPin?: boolean;
    lastChecked?: number;
  }
}
