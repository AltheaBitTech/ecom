-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('PASSWORD', 'GOOGLE', 'FACEBOOK', 'MICROSOFT', 'TWITTER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" "AuthProvider" NOT NULL DEFAULT 'PASSWORD',
ALTER COLUMN "passwordHash" DROP NOT NULL;
