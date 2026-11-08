import { Prisma, type PrismaClient } from "@prisma/client";

import {
  EmailJaCadastradoError,
  type AtivacaoConta,
  type ContaCriada,
  type ContaRepositorio,
  type ContaResumo,
  type CredenciaisConta,
  type NovaConta,
  type SessaoConta,
  type TokenPersistido,
  type TokenRegistro,
} from "../../modules/conta/repositorio";

/**
 * Implementação Prisma do port `ContaRepositorio` (RN-085).
 *
 * Toda operação multi-tabela é transacional: conta + aceites + token nascem
 * juntos; token consumido e conta ativada andam juntos. A unicidade de
 * e-mail é a do índice funcional `ux_usuario_email` — por isso a busca é
 * `mode: "insensitive"` e a violação chega como `P2002`.
 */

const CAMPOS_CONTA = {
  id: true,
  nome: true,
  email: true,
  statusConta: true,
  excluidoEm: true,
} as const;

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

export class ContaPrismaRepositorio implements ContaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorEmail(email: string): Promise<ContaResumo | null> {
    return this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: CAMPOS_CONTA,
    });
  }

  async criar(conta: NovaConta): Promise<ContaCriada> {
    try {
      return await this.prisma.$transaction((tx) => this.inserirConta(tx, conta));
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) {
        throw new EmailJaCadastradoError();
      }
      throw erro;
    }
  }

  private async inserirConta(
    tx: Prisma.TransactionClient,
    conta: NovaConta,
  ): Promise<ContaCriada> {
    const usuario = await tx.usuario.create({
      data: { nome: conta.nome, email: conta.email, senhaHash: conta.senhaHash },
      select: { id: true, email: true, statusConta: true },
    });

    await tx.aceiteLegal.createMany({
      data: conta.aceites.map((aceite) => ({
        usuarioId: usuario.id,
        tipo: aceite.tipo,
        versao: aceite.versao,
        ipHash: aceite.ipHash,
      })),
    });

    await tx.tokenConta.create({
      data: {
        usuarioId: usuario.id,
        tipo: "VERIFICACAO_EMAIL",
        tokenHash: conta.token.hash,
        expiraEm: conta.token.expiraEm,
      },
    });

    return usuario;
  }

  async buscarTokenPorHash(hash: string): Promise<TokenPersistido | null> {
    const token = await this.prisma.tokenConta.findUnique({
      where: { tokenHash: hash },
      select: {
        id: true,
        usuarioId: true,
        tipo: true,
        expiraEm: true,
        usadoEm: true,
        usuario: { select: { statusConta: true, excluidoEm: true } },
      },
    });

    if (token === null) {
      return null;
    }

    return {
      id: token.id,
      usuarioId: token.usuarioId,
      tipo: token.tipo,
      expiraEm: token.expiraEm,
      usadoEm: token.usadoEm,
      statusConta: token.usuario.statusConta,
      excluidoEm: token.usuario.excluidoEm,
    };
  }

  async ativarConta(ativacao: AtivacaoConta): Promise<{ emailVerificadoEm: Date } | null> {
    return this.prisma.$transaction(async (tx) => {
      const consumido = await tx.tokenConta.updateMany({
        where: { id: ativacao.tokenId, usuarioId: ativacao.usuarioId, usadoEm: null },
        data: { usadoEm: ativacao.agora },
      });

      if (consumido.count === 0) {
        return null;
      }

      const usuario = await tx.usuario.update({
        where: { id: ativacao.usuarioId },
        data: { statusConta: "ATIVA", emailVerificadoEm: ativacao.agora },
        select: { emailVerificadoEm: true },
      });

      return { emailVerificadoEm: usuario.emailVerificadoEm ?? ativacao.agora };
    });
  }

  async substituirTokenVerificacao(input: {
    usuarioId: string;
    token: TokenRegistro;
    agora: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.tokenConta.updateMany({
        where: { usuarioId: input.usuarioId, tipo: "VERIFICACAO_EMAIL", usadoEm: null },
        data: { usadoEm: input.agora },
      });

      await tx.tokenConta.create({
        data: {
          usuarioId: input.usuarioId,
          tipo: "VERIFICACAO_EMAIL",
          tokenHash: input.token.hash,
          expiraEm: input.token.expiraEm,
        },
      });
    });
  }

  async buscarCredenciais(email: string): Promise<CredenciaisConta | null> {
    return this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { ...CAMPOS_CONTA, senhaHash: true, sessionVersion: true },
    });
  }

  async registrarLogin(usuarioId: string, agora: Date): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { ultimoLoginEm: agora },
      select: { id: true },
    });
  }

  async buscarSessao(usuarioId: string): Promise<SessaoConta | null> {
    return this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { ...CAMPOS_CONTA, sessionVersion: true },
    });
  }
}
