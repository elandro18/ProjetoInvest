-- CreateEnum
CREATE TYPE "autenticacao_provedor" AS ENUM ('NENHUMA', 'API_KEY', 'OAUTH');

-- CreateEnum
CREATE TYPE "status_integracao" AS ENUM ('SUCESSO', 'ERRO', 'TIMEOUT', 'LIMITE', 'DADOS_INCOMPLETOS');

-- CreateTable
CREATE TABLE "provedor_dados" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "capacidades" JSONB NOT NULL,
    "autenticacao" "autenticacao_provedor" NOT NULL DEFAULT 'NENHUMA',
    "limite_requisicoes" VARCHAR(60),
    "custo" VARCHAR(160),
    "prioridade" SMALLINT NOT NULL DEFAULT 100,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provedor_dados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_integracao" (
    "id" UUID NOT NULL,
    "provedor_id" UUID NOT NULL,
    "operacao" VARCHAR(60) NOT NULL,
    "recurso" VARCHAR(120),
    "status" "status_integracao" NOT NULL,
    "http_status" SMALLINT,
    "duracao_ms" INTEGER,
    "data_consulta" TIMESTAMPTZ(6) NOT NULL,
    "data_referencia" DATE,
    "mensagem" VARCHAR(1000),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_integracao_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "log_integracao_duracao_ms_check" CHECK ("duracao_ms" IS NULL OR "duracao_ms" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "provedor_dados_nome_key" ON "provedor_dados"("nome");

-- CreateIndex
CREATE INDEX "ix_log_provedor_criado" ON "log_integracao"("provedor_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "ix_log_status_criado" ON "log_integracao"("status", "criado_em" DESC);

-- AddForeignKey
ALTER TABLE "log_integracao" ADD CONSTRAINT "log_integracao_provedor_id_fkey" FOREIGN KEY ("provedor_id") REFERENCES "provedor_dados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
