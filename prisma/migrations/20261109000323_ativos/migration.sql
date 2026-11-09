-- CreateEnum
CREATE TYPE "status_ativo" AS ENUM ('ATIVO', 'INATIVO', 'EM_ANALISE');

-- CreateTable
CREATE TABLE "ativo" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ticker" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "classe_id" UUID NOT NULL,
    "segmento_id" UUID,
    "cnpj" VARCHAR(14),
    "administrador" VARCHAR(160),
    "gestor" VARCHAR(160),
    "status" "status_ativo" NOT NULL DEFAULT 'ATIVO',
    "fonte_dados" VARCHAR(60),
    "observacoes" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ativo_pkey" PRIMARY KEY ("id"),
    -- Ticker sempre em maiúsculas, sem espaço (DATA_MODEL.md §4.4).
    CONSTRAINT "chk_ativo_ticker_formato" CHECK ("ticker" ~ '^[A-Z0-9]{4,20}$')
);

-- Mantém atualizado_em consistente em todo UPDATE (função da fundação técnica).
CREATE TRIGGER "trg_ativo_atualizado_em"
BEFORE UPDATE ON "ativo"
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- CreateIndex
CREATE INDEX "ix_ativo_usuario_status" ON "ativo"("usuario_id", "status");

-- CreateIndex
CREATE INDEX "ix_ativo_segmento" ON "ativo"("segmento_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_ativo_usuario_ticker" ON "ativo"("usuario_id", "ticker");

-- AddForeignKey
ALTER TABLE "ativo" ADD CONSTRAINT "ativo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ativo" ADD CONSTRAINT "ativo_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classe_ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ativo" ADD CONSTRAINT "ativo_segmento_id_fkey" FOREIGN KEY ("segmento_id") REFERENCES "segmento_ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
