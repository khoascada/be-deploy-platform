-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('VI', 'EN');

-- CreateEnum
CREATE TYPE "RunnerType" AS ENUM ('LOCAL', 'SSH');

-- CreateEnum
CREATE TYPE "GithubConnectionStatus" AS ENUM ('CONNECTED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('QUEUED', 'PULLING', 'BUILDING', 'DEPLOYING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DeploymentTrigger" AS ENUM ('MANUAL', 'GITHUB_PUSH');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "LogStream" AS ENUM ('SYSTEM', 'STDOUT', 'STDERR');

-- CreateEnum
CREATE TYPE "EnvScope" AS ENUM ('BUILD', 'RUNTIME', 'BOTH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "theme" "Theme" NOT NULL DEFAULT 'LIGHT',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "scopes" TEXT,
    "status" "GithubConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "revokedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "githubRepoId" TEXT,
    "githubDefaultBranch" TEXT NOT NULL,
    "deployBranch" TEXT NOT NULL,
    "rootDirectory" TEXT NOT NULL DEFAULT '.',
    "dockerfilePath" TEXT NOT NULL DEFAULT 'Dockerfile',
    "buildContext" TEXT NOT NULL DEFAULT '.',
    "runnerType" "RunnerType" NOT NULL DEFAULT 'LOCAL',
    "localRepoPath" TEXT,
    "sshHost" TEXT,
    "sshPort" INTEGER DEFAULT 22,
    "sshUser" TEXT,
    "sshKeyEncrypted" TEXT,
    "containerPort" INTEGER NOT NULL DEFAULT 3000,
    "hostPort" INTEGER,
    "containerName" TEXT,
    "imageName" TEXT,
    "autoDeploy" BOOLEAN NOT NULL DEFAULT true,
    "webhookId" TEXT,
    "webhookSecretEncrypted" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "deploymentNumber" INTEGER NOT NULL,
    "trigger" "DeploymentTrigger" NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'QUEUED',
    "branch" TEXT NOT NULL,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "commitAuthorName" TEXT,
    "commitAuthorEmail" TEXT,
    "githubDeliveryId" TEXT,
    "imageTag" TEXT,
    "containerId" TEXT,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentLog" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "stream" "LogStream" NOT NULL DEFAULT 'SYSTEM',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvVar" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "scope" "EnvScope" NOT NULL DEFAULT 'BOTH',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvVar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "githubDeliveryId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "action" TEXT,
    "signature" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GithubConnection_userId_key" ON "GithubConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubConnection_githubUserId_key" ON "GithubConnection"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_hostPort_key" ON "Project"("hostPort");

-- CreateIndex
CREATE UNIQUE INDEX "Project_containerName_key" ON "Project"("containerName");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_githubRepoId_idx" ON "Project"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_ownerId_slug_key" ON "Project"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_ownerId_githubRepoId_key" ON "Project"("ownerId", "githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_githubDeliveryId_key" ON "Deployment"("githubDeliveryId");

-- CreateIndex
CREATE INDEX "Deployment_projectId_createdAt_idx" ON "Deployment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_projectId_deploymentNumber_key" ON "Deployment"("projectId", "deploymentNumber");

-- CreateIndex
CREATE INDEX "DeploymentLog_projectId_createdAt_idx" ON "DeploymentLog"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentLog_deploymentId_seq_key" ON "DeploymentLog"("deploymentId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "EnvVar_projectId_key_scope_key" ON "EnvVar"("projectId", "key", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_githubDeliveryId_key" ON "WebhookEvent"("githubDeliveryId");

-- CreateIndex
CREATE INDEX "WebhookEvent_projectId_idx" ON "WebhookEvent"("projectId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventName_idx" ON "WebhookEvent"("eventName");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- AddForeignKey
ALTER TABLE "GithubConnection" ADD CONSTRAINT "GithubConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLog" ADD CONSTRAINT "DeploymentLog_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLog" ADD CONSTRAINT "DeploymentLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvVar" ADD CONSTRAINT "EnvVar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
