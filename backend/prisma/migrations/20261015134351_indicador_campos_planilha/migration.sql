/*
  Warnings:

  - You are about to drop the column `origemPlanilha` on the `Indicador` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Indicador" DROP COLUMN "origemPlanilha",
ADD COLUMN     "apresentacao" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "dadosPlanilha" JSONB,
ADD COLUMN     "idsPlanilha" TEXT[] DEFAULT ARRAY[]::TEXT[];
