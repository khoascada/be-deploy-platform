/*
  Warnings:

  - You are about to drop the column `errorMessage` on the `WebhookEvent` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PENDING', 'PROCESSED', 'IGNORED', 'FAILED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "WebhookEvent" DROP COLUMN "errorMessage",
ADD COLUMN     "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "statusReason" TEXT;
