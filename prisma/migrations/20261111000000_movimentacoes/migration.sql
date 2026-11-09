-- CreateEnum
CREATE TYPE "tipo_movimentacao" AS ENUM ('COMPRA', 'VENDA', 'DIVIDENDO', 'JUROS', 'APLICACAO_RF', 'RESGATE_RF', 'TAXA');

-- CreateEnum
CREATE TYPE "tipo_rendimento" AS ENUM ('DIVIDENDO', 'JURO', 'AMORTIZACAO');

-- CreateEnum
CREATE TYPE "origem_dado" AS ENUM ('MANUAL', 'PROVEDOR', 'IMPORTACAO_CVM');

-- CreateTable
CREATE TABLE "movimentacao" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ativo_id" UUID NOT NULL,
    "tipo" "tipo_movimentacao" NOT NULL,
    "data" DATE NOT NULL,
    "quantidade" DECIMAL(18,8),
    "valor_unitario" DECIMAL(18,2),
    "valor_total" DECIMAL(18,2) NOT NULL,
    "custos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "cancelada_em" TIMESTAMPTZ(6),
    "cancelamento_motivo" TEXT,
    "idempotency_key" VARCHAR(64),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacao_pkey" PRIMARY KEY ("id"),
    -- RN-014/RN-019: quantidade positiva quando informada; valor total positivo;
    -- custos não negativos; COMPRA/VENDA exigem quantidade e valor unitário.
    CONSTRAINT "chk_mov_qtd_positiva" CHECK ("quantidade" IS NULL OR "quantidade" > 0),
    CONSTRAINT "chk_mov_valor_positivo" CHECK ("valor_total" > 0),
    CONSTRAINT "chk_mov_custos_nao_negativos" CHECK ("custos" >= 0),
    CONSTRAINT "chk_mov_qtd_obrigatoria" CHECK (
        "tipo" NOT IN ('COMPRA', 'VENDA')
        OR ("quantidade" IS NOT NULL AND "valor_unitario" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "posicao_ativo" (
    "usuario_id" UUID NOT NULL,
    "ativo_id" UUID NOT NULL,
    "quantidade" DECIMAL(18,8) NOT NULL,
    "preco_medio" DECIMAL(18,6) NOT NULL,
    "custo_total" DECIMAL(18,2) NOT NULL,
    "ultima_movimentacao_id" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posicao_ativo_pkey" PRIMARY KEY ("usuario_id","ativo_id"),
    -- RN-015: cache derivado nunca assume quantidade/preço/custo negativos.
    CONSTRAINT "chk_posicao_quantidade" CHECK ("quantidade" >= 0),
    CONSTRAINT "chk_posicao_preco_medio" CHECK ("preco_medio" >= 0),
    CONSTRAINT "chk_posicao_custo_total" CHECK ("custo_total" >= 0)
);

-- CreateTable
CREATE TABLE "rendimento" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ativo_id" UUID NOT NULL,
    "tipo" "tipo_rendimento" NOT NULL,
    "data_pagamento" DATE NOT NULL,
    "competencia" CHAR(7),
    "valor" DECIMAL(18,2) NOT NULL,
    "origem" "origem_dado" NOT NULL,
    "movimentacao_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rendimento_pkey" PRIMARY KEY ("id"),
    -- RN-017: provento sempre positivo.
    CONSTRAINT "chk_rendimento_valor" CHECK ("valor" > 0)
);

-- Mantém atualizado_em consistente em todo UPDATE (função da fundação técnica).
CREATE TRIGGER "trg_posicao_atualizado_em"
BEFORE UPDATE ON "posicao_ativo"
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- CreateIndex
-- RN-014: idempotência única por usuário, apenas quando a chave foi enviada.
CREATE UNIQUE INDEX "ux_mov_idempotency"
ON "movimentacao"("usuario_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ix_mov_usuario_data" ON "movimentacao"("usuario_id", "data" DESC);

-- CreateIndex
CREATE INDEX "ix_mov_ativo_data" ON "movimentacao"("ativo_id", "data");

-- CreateIndex
CREATE INDEX "ix_rend_usuario_data" ON "rendimento"("usuario_id", "data_pagamento");

-- CreateIndex
CREATE INDEX "ix_rend_ativo_competencia" ON "rendimento"("ativo_id", "competencia");

-- AddForeignKey
ALTER TABLE "movimentacao" ADD CONSTRAINT "movimentacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao" ADD CONSTRAINT "movimentacao_ativo_id_fkey" FOREIGN KEY ("ativo_id") REFERENCES "ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posicao_ativo" ADD CONSTRAINT "posicao_ativo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posicao_ativo" ADD CONSTRAINT "posicao_ativo_ativo_id_fkey" FOREIGN KEY ("ativo_id") REFERENCES "ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posicao_ativo" ADD CONSTRAINT "posicao_ativo_ultima_movimentacao_id_fkey" FOREIGN KEY ("ultima_movimentacao_id") REFERENCES "movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendimento" ADD CONSTRAINT "rendimento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendimento" ADD CONSTRAINT "rendimento_ativo_id_fkey" FOREIGN KEY ("ativo_id") REFERENCES "ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendimento" ADD CONSTRAINT "rendimento_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
