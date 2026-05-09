import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "enlw_user";
const KEY_LENGTH = 64;

export async function getCurrentUser() {
  await ensureBootstrapAdmin();

  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function signIn(
  username: string,
  password: string,
  displayName?: string,
  email?: string,
) {
  await ensureBootstrapAdmin();

  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = email?.trim().toLowerCase() || undefined;
  const safeDisplayName = displayName?.trim() || normalizedUsername;
  const existingUser = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });

  const user = existingUser
    ? await signInExistingUser(existingUser, password, safeDisplayName, normalizedEmail)
    : await prisma.user.create({
        data: {
          username: normalizedUsername,
          passwordHash: hashPassword(password),
          role: "STUDENT",
          isVip: false,
          displayName: safeDisplayName,
          email: normalizedEmail,
        },
      });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  return toPublicUser(user);
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function signInExistingUser(
  user: {
    id: string;
    passwordHash: string | null;
  },
  password: string,
  displayName: string,
  email?: string,
) {
  if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: user.passwordHash ?? hashPassword(password),
      displayName,
      email,
    },
  });
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function shouldUseSecureCookie() {
  return process.env.APP_PUBLIC_BASE_URL?.startsWith("https://") ?? false;
}

const userSelect = {
  id: true,
  username: true,
  role: true,
  isVip: true,
  displayName: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPublicUser(user: {
  id: string;
  username: string | null;
  role: UserRole;
  isVip: boolean;
  displayName: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isVip: user.isVip,
    displayName: user.displayName,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function ensureBootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return;
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { username },
  });

  if (existingAdmin) {
    if (existingAdmin.role !== "ADMIN" || !existingAdmin.passwordHash) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: "ADMIN",
          isVip: true,
          passwordHash: existingAdmin.passwordHash ?? hashPassword(password),
        },
      });
    }
    return;
  }

  await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      displayName: "Administrator",
      role: "ADMIN",
      isVip: true,
    },
  });
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedValue: string) {
  const [salt, storedHash] = storedValue.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const hash = scryptSync(password, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(storedHash, "hex");

  return storedBuffer.length === hash.length && timingSafeEqual(storedBuffer, hash);
}
