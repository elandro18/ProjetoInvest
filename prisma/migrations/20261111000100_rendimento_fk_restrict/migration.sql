-- DropForeignKey
ALTER TABLE "rendimento" DROP CONSTRAINT "rendimento_movimentacao_id_fkey";

-- AddForeignKey
ALTER TABLE "rendimento" ADD CONSTRAINT "rendimento_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
