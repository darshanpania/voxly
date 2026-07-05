import { prisma } from "../db.js";

export const FREE_DAILY_MESSAGES = 50;
export const FREE_DAILY_VOICE_SECONDS = 300;

export interface Allowance {
  allowed: boolean;
  used: number;
  limit: number;
}

/** Start of the current day in UTC. */
function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Reads User.isPremium. A missing user is treated as not premium. */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true },
  });
  return user?.isPremium ?? false;
}

/**
 * Counts today's (UTC) user-role messages across all of the user's sessions.
 * Premium users are always allowed.
 */
export async function checkMessageAllowance(
  userId: string,
): Promise<Allowance> {
  const limit = FREE_DAILY_MESSAGES;

  if (await isPremiumUser(userId)) {
    return { allowed: true, used: 0, limit };
  }

  const used = await prisma.message.count({
    where: {
      role: "user",
      createdAt: { gte: startOfUtcDay() },
      session: { userId },
    },
  });

  return { allowed: used < limit, used, limit };
}

/**
 * Reads (upserting if missing) the UserLanguageProfile, resetting the daily
 * voice counter when lastResetAt predates the current UTC day.
 * Premium users are always allowed.
 */
export async function checkVoiceAllowance(
  userId: string,
  language: string,
): Promise<Allowance> {
  const limit = FREE_DAILY_VOICE_SECONDS;

  const profile = await prisma.userLanguageProfile.upsert({
    where: { userId_language: { userId, language } },
    update: {},
    create: { userId, language },
  });

  const dayStart = startOfUtcDay();
  let used = profile.voiceSecondsUsedToday;

  if (profile.lastResetAt < dayStart) {
    const reset = await prisma.userLanguageProfile.update({
      where: { userId_language: { userId, language } },
      data: { voiceSecondsUsedToday: 0, lastResetAt: new Date() },
    });
    used = reset.voiceSecondsUsedToday;
  }

  if (await isPremiumUser(userId)) {
    return { allowed: true, used, limit };
  }

  return { allowed: used < limit, used, limit };
}

/** Increments the daily voice-seconds counter, upserting the profile if missing. */
export async function addVoiceSeconds(
  userId: string,
  language: string,
  seconds: number,
): Promise<void> {
  await prisma.userLanguageProfile.upsert({
    where: { userId_language: { userId, language } },
    update: { voiceSecondsUsedToday: { increment: seconds } },
    create: { userId, language, voiceSecondsUsedToday: seconds },
  });
}
