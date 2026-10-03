-- AlterTable
ALTER TABLE "StatusHistory" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRule_category_key" ON "CategoryRule"("category");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
