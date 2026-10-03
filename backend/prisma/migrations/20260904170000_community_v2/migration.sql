-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reopenCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ResolutionVerification" ADD COLUMN     "stars" INTEGER;

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
