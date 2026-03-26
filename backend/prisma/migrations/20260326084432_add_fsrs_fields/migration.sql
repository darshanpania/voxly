-- AlterTable
ALTER TABLE "VocabularyItem" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "elapsedDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReviewAt" TIMESTAMP(3),
ADD COLUMN     "reps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "state" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SessionSummary" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "mistakes" JSONB NOT NULL,
    "newVocab" JSONB NOT NULL,
    "encouragement" TEXT NOT NULL,

    CONSTRAINT "SessionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionSummary_sessionId_key" ON "SessionSummary"("sessionId");

-- AddForeignKey
ALTER TABLE "SessionSummary" ADD CONSTRAINT "SessionSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
