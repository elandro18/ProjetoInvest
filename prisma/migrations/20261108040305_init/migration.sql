-- CreateTable
CREATE TABLE "classe_ativo" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "classe_ativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segmento_ativo" (
    "id" UUID NOT NULL,
    "classe_id" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "segmento_ativo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classe_ativo_codigo_key" ON "classe_ativo"("codigo");

-- CreateIndex
CREATE INDEX "segmento_ativo_classe_id_idx" ON "segmento_ativo"("classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "segmento_ativo_classe_id_codigo_key" ON "segmento_ativo"("classe_id", "codigo");

-- AddForeignKey
ALTER TABLE "segmento_ativo" ADD CONSTRAINT "segmento_ativo_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classe_ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
