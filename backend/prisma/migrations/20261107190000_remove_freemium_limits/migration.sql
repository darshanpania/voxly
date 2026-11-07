-- Voxly is a personal app: drop the freemium plan flag and daily voice quota.
-- AlterTable
ALTER TABLE "User" DROP COLUMN "isPremium";

-- AlterTable
ALTER TABLE "UserLanguageProfile" DROP COLUMN "lastResetAt",
DROP COLUMN "voiceSecondsUsedToday";
