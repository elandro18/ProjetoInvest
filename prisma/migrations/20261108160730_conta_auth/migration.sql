-- CreateEnum
CREATE TYPE "status_conta" AS ENUM ('PENDENTE_VERIFICACAO', 'ATIVA', 'SUSPENSA', 'EXCLUIDA');

-- CreateEnum
CREATE TYPE "tipo_token_conta" AS ENUM ('VERIFICACAO_EMAIL', 'REDEFINICAO_SENHA');

-- CreateEnum
CREATE TYPE "tipo_aceite_legal" AS ENUM ('TERMOS_USO', 'POLITICA_PRIVACIDADE');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "status_conta" "status_conta" NOT NULL DEFAULT 'PENDENTE_VERIFICACAO',
    "email_verificado_em" TIMESTAMPTZ(6),
    "ultimo_login_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluido_em" TIMESTAMPTZ(6),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- Unicidade de e-mail case-insensitive (DATA_MODEL.md §4.1).
-- Índice funcional não é expressável no schema Prisma: aplicado somente aqui.
CREATE UNIQUE INDEX "ux_usuario_email" ON "usuario" (lower("email"));

-- atualizado_em consistente em todo UPDATE (função criada na fundação técnica).
CREATE TRIGGER "trg_usuario_atualizado_em"
BEFORE UPDATE ON "usuario"
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- CreateTable
CREATE TABLE "token_conta" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "tipo_token_conta" NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "usado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceite_legal" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "tipo_aceite_legal" NOT NULL,
    "versao" VARCHAR(20) NOT NULL,
    "aceito_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" VARCHAR(64),

    CONSTRAINT "aceite_legal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_token_hash" ON "token_conta"("token_hash");

-- CreateIndex
CREATE INDEX "ix_token_usuario_tipo" ON "token_conta"("usuario_id", "tipo", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "ix_aceite_usuario_tipo" ON "aceite_legal"("usuario_id", "tipo", "aceito_em" DESC);

-- AddForeignKey
ALTER TABLE "token_conta" ADD CONSTRAINT "token_conta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceite_legal" ADD CONSTRAINT "aceite_legal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
