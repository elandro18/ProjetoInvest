-- CreateEnum
CREATE TYPE "escopo_meta" AS ENUM ('CLASSE', 'SEGMENTO');

-- CreateTable
CREATE TABLE "alocacao_meta" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "escopo" "escopo_meta" NOT NULL,
    "classe_id" UUID,
    "segmento_id" UUID,
    "percentual" DECIMAL(9,6) NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alocacao_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_meta_usuario_escopo" ON "alocacao_meta"("usuario_id", "escopo", "vigencia_inicio" DESC);

-- AddForeignKey
ALTER TABLE "alocacao_meta" ADD CONSTRAINT "alocacao_meta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_meta" ADD CONSTRAINT "alocacao_meta_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classe_ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao_meta" ADD CONSTRAINT "alocacao_meta_segmento_id_fkey" FOREIGN KEY ("segmento_id") REFERENCES "segmento_ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks de RN-021 (DATA_MODEL.md §4.9): exatamente uma referência coerente
-- com o escopo, percentual na faixa 0..100 e vigência final não anterior ao início.
ALTER TABLE "alocacao_meta" ADD CONSTRAINT "chk_meta_referencia" CHECK (
    ("escopo" = 'CLASSE' AND "classe_id" IS NOT NULL AND "segmento_id" IS NULL) OR
    ("escopo" = 'SEGMENTO' AND "segmento_id" IS NOT NULL AND "classe_id" IS NULL)
);

ALTER TABLE "alocacao_meta" ADD CONSTRAINT "chk_meta_percentual" CHECK (
    "percentual" >= 0 AND "percentual" <= 100
);

ALTER TABLE "alocacao_meta" ADD CONSTRAINT "chk_meta_vigencia" CHECK (
    "vigencia_fim" IS NULL OR "vigencia_fim" >= "vigencia_inicio"
);

-- Uma única linha vigente por referência/escopo. O índice parcial isola a
-- vigência corrente; o histórico (vigencia_fim preenchida) não é limitado.
CREATE UNIQUE INDEX "ux_meta_vigente_classe" ON "alocacao_meta" ("usuario_id", "escopo", "classe_id")
    WHERE "vigencia_fim" IS NULL AND "classe_id" IS NOT NULL;

CREATE UNIQUE INDEX "ux_meta_vigente_segmento" ON "alocacao_meta" ("usuario_id", "escopo", "segmento_id")
    WHERE "vigencia_fim" IS NULL AND "segmento_id" IS NOT NULL;
