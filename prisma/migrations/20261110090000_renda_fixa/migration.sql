-- Renda fixa (RN-057, RN-059; DATA_MODEL.md §4.8).
-- Enums, tabela, CHECKs de taxa/valor/vencimento, índices por usuário e trigger
-- de atualizado_em (função criada na fundação técnica).

-- CreateEnum
CREATE TYPE "produto_renda_fixa" AS ENUM ('TESOURO_SELIC', 'TESOURO_IPCA', 'TESOURO_PREFIXADO', 'CDB', 'LCI', 'LCA', 'DEBENTURE', 'OUTRO');

-- CreateEnum
CREATE TYPE "indexador_renda_fixa" AS ENUM ('PRE', 'POS_CDI', 'IPCA', 'SELIC', 'OUTRO');

-- CreateEnum
CREATE TYPE "liquidez_renda_fixa" AS ENUM ('DIARIA', 'NO_VENCIMENTO', 'PRAZO');

-- CreateEnum
CREATE TYPE "status_saldo" AS ENUM ('INFORMADO', 'ESTIMADO', 'CONFIRMADO');

-- CreateTable
CREATE TABLE "investimento_renda_fixa" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "instituicao" VARCHAR(120) NOT NULL,
    "produto" "produto_renda_fixa" NOT NULL,
    "indexador" "indexador_renda_fixa" NOT NULL,
    "taxa" DECIMAL(9,6) NOT NULL,
    "data_aplicacao" DATE NOT NULL,
    "vencimento" DATE,
    "valor_aplicado" DECIMAL(18,2) NOT NULL,
    "saldo_atual" DECIMAL(18,2) NOT NULL,
    "status_saldo" "status_saldo" NOT NULL DEFAULT 'INFORMADO',
    "liquidez" "liquidez_renda_fixa" NOT NULL,
    "carencia_ate" DATE,
    "cobertura_fgc" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investimento_renda_fixa_pkey" PRIMARY KEY ("id"),
    -- RN-057: taxa em % a.a. entre 0 e 100; valores positivos; vencimento posterior à aplicação.
    CONSTRAINT "chk_rf_taxa" CHECK ("taxa" >= 0 AND "taxa" <= 100),
    CONSTRAINT "chk_rf_valor_aplicado" CHECK ("valor_aplicado" > 0),
    CONSTRAINT "chk_rf_saldo_atual" CHECK ("saldo_atual" >= 0),
    CONSTRAINT "chk_rf_vencimento" CHECK ("vencimento" IS NULL OR "vencimento" > "data_aplicacao")
);

-- Mantém atualizado_em consistente em todo UPDATE (função da fundação técnica).
CREATE TRIGGER "trg_rf_atualizado_em"
BEFORE UPDATE ON "investimento_renda_fixa"
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- CreateIndex
CREATE INDEX "ix_rf_usuario_vencimento" ON "investimento_renda_fixa"("usuario_id", "vencimento");

-- CreateIndex
CREATE INDEX "ix_rf_usuario_instituicao" ON "investimento_renda_fixa"("usuario_id", "instituicao");

-- AddForeignKey
ALTER TABLE "investimento_renda_fixa" ADD CONSTRAINT "investimento_renda_fixa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
