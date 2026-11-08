import { errors, type AppError } from "../../lib/errors";
import { err, isErr, ok, type Result } from "../../lib/result";
import { versoesVigentes } from "./legal";
import { linkVerificacao, type Mailer } from "./mailer";
import {
  EmailJaCadastradoError,
  type ContaCriada,
  type ContaRepositorio,
  type StatusConta,
} from "./repositorio";
import { senhaAceitavel, type HashSenha } from "./senha";
import {
  calcularExpiracao,
  VALIDADE_VERIFICACAO_EMAIL_MS,
  type GerarToken,
  type TokenGerado,
} from "./token";

/**
 * Cadastro de titular (RN-069, RN-071, RN-085, RN-087).
 *
 * Ordem das regras: dados de forma já vieram validados da borda (`VALIDACAO`);
 * aqui ficam as regras de negócio — força de senha, aceite obrigatório,
 * versão vigente dos documentos e unicidade de e-mail. A conta nasce
 * `PENDENTE_VERIFICACAO` com os dois aceites e o token de 24 h na mesma
 * transação, para não existir conta sem evidência de consentimento.
 */

export interface CadastroComando {
  readonly nome: string;
  readonly email: string;
  readonly senha: string;
  readonly aceiteTermos: boolean;
  readonly aceitePrivacidade: boolean;
  readonly versaoTermos: string;
  readonly versaoPrivacidade: string;
  readonly ipHash: string | null;
}

export interface CadastroDeps {
  readonly repositorio: ContaRepositorio;
  readonly mailer: Mailer;
  readonly hashSenha: HashSenha;
  readonly gerarToken: GerarToken;
  readonly appUrl: string;
  readonly agora?: () => Date;
}

export interface CadastroResultado {
  readonly id: string;
  readonly email: string;
  readonly statusConta: StatusConta;
}

function validarRegras(comando: CadastroComando): AppError | null {
  if (!senhaAceitavel(comando.senha)) {
    return errors.authSenhaFraca();
  }

  if (!comando.aceiteTermos || !comando.aceitePrivacidade) {
    return errors.authAceiteObrigatorio();
  }

  if (!versoesVigentes(comando.versaoTermos, comando.versaoPrivacidade)) {
    return errors.authVersaoTermosDesatualizada();
  }

  return null;
}

interface ContaEmitida {
  readonly conta: ContaCriada;
  readonly token: TokenGerado;
  readonly expiraEm: Date;
}

async function emitirConta(
  comando: CadastroComando,
  deps: CadastroDeps,
  dados: { nome: string; email: string; agora: Date },
): Promise<Result<ContaEmitida, AppError>> {
  const token = deps.gerarToken();
  const expiraEm = calcularExpiracao(dados.agora, VALIDADE_VERIFICACAO_EMAIL_MS);

  try {
    const conta = await deps.repositorio.criar({
      nome: dados.nome,
      email: dados.email,
      senhaHash: await deps.hashSenha(comando.senha),
      aceites: [
        { tipo: "TERMOS_USO", versao: comando.versaoTermos.trim(), ipHash: comando.ipHash },
        {
          tipo: "POLITICA_PRIVACIDADE",
          versao: comando.versaoPrivacidade.trim(),
          ipHash: comando.ipHash,
        },
      ],
      token: { hash: token.hash, expiraEm },
    });

    return ok({ conta, token, expiraEm });
  } catch (erro) {
    if (erro instanceof EmailJaCadastradoError) {
      return err(errors.authEmailJaCadastrado());
    }
    throw erro;
  }
}

export async function cadastrar(
  comando: CadastroComando,
  deps: CadastroDeps,
): Promise<Result<CadastroResultado, AppError>> {
  const agora = deps.agora?.() ?? new Date();
  const nome = comando.nome.trim();
  const email = comando.email.trim().toLowerCase();

  const violacao = validarRegras(comando);
  if (violacao !== null) {
    return err(violacao);
  }

  if ((await deps.repositorio.buscarPorEmail(email)) !== null) {
    return err(errors.authEmailJaCadastrado());
  }

  const emitida = await emitirConta(comando, deps, { nome, email, agora });
  if (isErr(emitida)) {
    return emitida;
  }

  await deps.mailer.enviarVerificacaoEmail({
    para: emitida.value.conta.email,
    nome,
    link: linkVerificacao(deps.appUrl, emitida.value.token.token),
    expiraEm: emitida.value.expiraEm,
  });

  return ok({
    id: emitida.value.conta.id,
    email: emitida.value.conta.email,
    statusConta: emitida.value.conta.statusConta,
  });
}
