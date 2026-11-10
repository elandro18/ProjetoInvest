-- CreateEnum
CREATE TYPE "decisao_usuario" AS ENUM ('ACEITA', 'IGNORADA', 'ALTERADA');

-- CreateTable
CREATE TABLE "sugestao_aporte" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "data" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valor_disponivel" DECIMAL(18,2) NOT NULL,
    "distribuicao_atual" JSONB NOT NULL,
    "distribuicao_sugerida" JSONB NOT NULL,
    "ativos_avaliados" JSONB NOT NULL DEFAULT '[]',
    "justificativas" JSONB NOT NULL DEFAULT '[]',
    "alertas" JSONB NOT NULL DEFAULT '[]',
    "decisao_usuario" "decisao_usuario",
    "decisao_em" TIMESTAMPTZ(6),

    CONSTRAINT "sugestao_aporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_sug_usuario_data" ON "sugestao_aporte"("usuario_id", "data" DESC);

-- AddForeignKey
ALTER TABLE "sugestao_aporte" ADD CONSTRAINT "sugestao_aporte_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check de RN-025 (DATA_MODEL.md §4.15): o aporte sugerido é sempre positivo.
ALTER TABLE "sugestao_aporte" ADD CONSTRAINT "chk_sugestao_valor" CHECK (
    "valor_disponivel" > 0
);
