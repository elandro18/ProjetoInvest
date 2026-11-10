-- CreateEnum
CREATE TYPE "dimensao_concentracao" AS ENUM ('ATIVO', 'GESTORA', 'SEGMENTO', 'EMISSOR', 'IMOVEL');

-- CreateTable
CREATE TABLE "limite_concentracao" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "dimensao" "dimensao_concentracao" NOT NULL,
    "referencia" VARCHAR(120),
    "percentual_max" DECIMAL(9,6) NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "limite_concentracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_limite_usuario" ON "limite_concentracao"("usuario_id", "dimensao");

-- AddForeignKey
ALTER TABLE "limite_concentracao" ADD CONSTRAINT "limite_concentracao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks de RN-049 (DATA_MODEL.md §4.18): percentual na faixa (0, 100] e
-- vigência final nunca anterior ao início.
ALTER TABLE "limite_concentracao" ADD CONSTRAINT "chk_limite_percentual" CHECK (
    "percentual_max" > 0 AND "percentual_max" <= 100
);

ALTER TABLE "limite_concentracao" ADD CONSTRAINT "chk_limite_vigencia" CHECK (
    "vigencia_fim" IS NULL OR "vigencia_fim" >= "vigencia_inicio"
);

-- Um único limite vigente por dimensão/referência. O índice parcial isola a
-- vigência corrente; o histórico (vigencia_fim preenchida) não é limitado.
CREATE UNIQUE INDEX "ux_limite_vigente" ON "limite_concentracao" ("usuario_id", "dimensao", (COALESCE("referencia", '')))
    WHERE "vigencia_fim" IS NULL;
