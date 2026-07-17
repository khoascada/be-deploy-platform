/*
  Warnings:

  - A unique constraint covering the columns `[projectId,key]` on the table `EnvVar` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "EnvVar_projectId_key_scope_key";

-- CreateIndex
CREATE UNIQUE INDEX "EnvVar_projectId_key_key" ON "EnvVar"("projectId", "key");
