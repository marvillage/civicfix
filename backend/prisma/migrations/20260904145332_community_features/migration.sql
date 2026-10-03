-- DropForeignKey
ALTER TABLE "Complaint" DROP CONSTRAINT "Complaint_citizenId_fkey";

-- AlterTable
ALTER TABLE "Complaint" ALTER COLUMN "citizenId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "resolutionImageUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
