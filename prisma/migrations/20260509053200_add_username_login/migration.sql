ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User"
SET "username" = 'user_' || substr("id", 1, 8)
WHERE "username" IS NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
