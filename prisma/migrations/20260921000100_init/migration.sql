CREATE TABLE "Store" (
  "id" TEXT NOT NULL,
  "shopDomain" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "apiKeyHash" TEXT NOT NULL,
  "signingSecretHash" TEXT NOT NULL,
  "signingSecretEncrypted" TEXT NOT NULL,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OAuthState" (
  "state" TEXT NOT NULL,
  "shopDomain" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("state")
);
CREATE TABLE "PublishJob" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "operation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "articleId" TEXT,
  "articleUrl" TEXT,
  "requestJson" JSONB NOT NULL,
  "responseJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Store_shopDomain_key" ON "Store"("shopDomain");
CREATE UNIQUE INDEX "Store_apiKeyHash_key" ON "Store"("apiKeyHash");
CREATE UNIQUE INDEX "PublishJob_storeId_externalId_key" ON "PublishJob"("storeId", "externalId");
CREATE INDEX "PublishJob_storeId_createdAt_idx" ON "PublishJob"("storeId", "createdAt");
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
