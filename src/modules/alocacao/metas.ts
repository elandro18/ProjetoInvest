import { Decimal } from "../../lib/decimal";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type {
  EscopoMeta,
  NovaMeta,
  ReferenciasAlocacao,
  ReferenciaClasse,
  ReferenciaSegmento,
} from "./repositorio";

/**
 * Estratégia inicial de alocação (RN-021, RN-022; RN-021-1).
 *
 * O conjunto é dado por usuário, não constante global (RN-082): por isso os
 * defaults são materializados na primeira leitura de cada titular, e não em um
 * seed único do banco.
 *
 * A especificação agrupa "Renda Urbana e Híbridos" em 15%. Como são segmentos
 * distintos na base, a meta é dividida igualmente (7,5% cada) para que cada
 * segmento tenha sua própria linha e a soma por escopo continue exata em 100%.
 */

export const META_PERCENTUAL_TOTAL = "100.000000";

/** Tolerância de "dentro da meta" em pontos percentuais (RN-090). */
export const TOLERANCIA_DESVIO_PONTOS = "0.5";

export type SituacaoDesvio = "ABAIXO" | "ACIMA" | "DENTRO";

interface MetaPadrao {
  readonly codigo: string;
  readonly percentual: string;
}

export const METAS_CLASSE_PADRAO: readonly MetaPadrao[] = [
  { codigo: "RENDA_FIXA", percentual: "50.000000" },
  { codigo: "FII", percentual: "50.000000" },
];

export const METAS_SEGMENTO_PADRAO: readonly MetaPadrao[] = [
  { codigo: "LOGISTICA", percentual: "25.000000" },
  { codigo: "SHOPPING", percentual: "15.000000" },
  { codigo: "RECEBIVEIS", percentual: "25.000000" },
  { codigo: "LAJES", percentual: "10.000000" },
  { codigo: "AGRO", percentual: "5.000000" },
  { codigo: "CAIXA_OPORTUNIDADES", percentual: "5.000000" },
  { codigo: "RENDA_URBANA", percentual: "7.500000" },
  { codigo: "HIBRIDO", percentual: "7.500000" },
];

export interface EntradaMeta {
  readonly referenciaId: string;
  readonly percentual: string;
}

/** Corpo de `PUT /api/alocacao/metas` já validado na forma pela borda. */
export interface EntradaMetas {
  readonly classe: readonly EntradaMeta[];
  readonly segmento: readonly EntradaMeta[];
}

function referenciaInvalida(escopo: EscopoMeta, referencia: Record<string, string>): AppError {
  return errors.aloReferenciaInvalida({ escopo, ...referencia });
}

function resolverClasse(
  classes: ReadonlyMap<string, ReferenciaClasse>,
  referenciaId: string,
): ReferenciaClasse | undefined {
  return classes.get(referenciaId);
}

function resolverSegmento(
  segmentos: ReadonlyMap<string, ReferenciaSegmento>,
  referenciaId: string,
): ReferenciaSegmento | undefined {
  return segmentos.get(referenciaId);
}

function montarPadrao(
  escopo: EscopoMeta,
  padroes: readonly MetaPadrao[],
  porCodigo: ReadonlyMap<string, { readonly id: string }>,
): Result<readonly NovaMeta[], AppError> {
  const metas: NovaMeta[] = [];

  for (const padrao of padroes) {
    const referencia = porCodigo.get(padrao.codigo);
    if (referencia === undefined) {
      return err(referenciaInvalida(escopo, { codigo: padrao.codigo }));
    }
    metas.push({ escopo, referenciaId: referencia.id, percentual: padrao.percentual });
  }

  return ok(metas);
}

/** Constrói o conjunto default a partir do catálogo de referências ativas. */
export function montarDefaults(
  referencias: ReferenciasAlocacao,
): Result<readonly NovaMeta[], AppError> {
  const classes = new Map(
    referencias.classes.filter((classe) => classe.ativo).map((classe) => [classe.codigo, classe]),
  );
  const segmentos = new Map(
    referencias.segmentos
      .filter((segmento) => segmento.ativo)
      .map((segmento) => [segmento.codigo, segmento]),
  );

  const classe = montarPadrao("CLASSE", METAS_CLASSE_PADRAO, classes);
  if (!classe.ok) {
    return classe;
  }

  const segmento = montarPadrao("SEGMENTO", METAS_SEGMENTO_PADRAO, segmentos);
  if (!segmento.ok) {
    return segmento;
  }

  return ok([...classe.value, ...segmento.value]);
}

function validarEscopo(
  escopo: EscopoMeta,
  itens: readonly EntradaMeta[],
  classes: ReadonlyMap<string, ReferenciaClasse>,
  segmentos: ReadonlyMap<string, ReferenciaSegmento>,
): Result<readonly NovaMeta[], AppError> {
  const vistos = new Set<string>();
  const normalizados: { readonly referenciaId: string; readonly percentual: string }[] = [];
  let soma = Decimal.zero(6);

  for (const [indice, item] of itens.entries()) {
    if (vistos.has(item.referenciaId)) {
      return err(errors.aloMetaDuplicada({ escopo, referenciaId: item.referenciaId }));
    }
    vistos.add(item.referenciaId);

    const percentual = Decimal.parse(item.percentual);
    if (!percentual.ok) {
      return err(
        errors.validacao([
          { field: `${escopo}[${indice}].percentual`, message: "Percentual inválido." },
        ]),
      );
    }

    if (percentual.value.lt("0") || percentual.value.gt("100")) {
      return err(
        errors.validacao([
          {
            field: `${escopo}[${indice}].percentual`,
            message: "O percentual deve estar entre 0 e 100.",
          },
        ]),
      );
    }

    soma = soma.add(percentual.value);
    normalizados.push({
      referenciaId: item.referenciaId,
      percentual: percentual.value.toFixed(6),
    });
  }

  // A soma é exata e por escopo (RN-021, RN-022): nada de tolerância aqui.
  if (!soma.eq("100")) {
    return err(errors.aloSomaMetasInvalida({ escopo, soma: soma.toFixed(6) }));
  }

  const metas: NovaMeta[] = [];
  for (const item of normalizados) {
    const existe =
      escopo === "CLASSE"
        ? resolverClasse(classes, item.referenciaId) !== undefined
        : resolverSegmento(segmentos, item.referenciaId) !== undefined;

    if (!existe) {
      return err(referenciaInvalida(escopo, { referenciaId: item.referenciaId }));
    }

    metas.push({
      escopo,
      referenciaId: item.referenciaId,
      percentual: item.percentual,
    });
  }

  return ok(metas);
}

/**
 * Valida o conjunto recebido pelo `PUT`.
 *
 * Ordem: duplicidade dentro do escopo → percentual válido (0..100) → soma
 * exata de 100 → referência existente e ativa. Só referências ativas passam —
 * uma referência inativa é tratada como inexistente para o titular.
 */
export function validarEntradaMetas(
  entrada: EntradaMetas,
  referencias: ReferenciasAlocacao,
): Result<readonly NovaMeta[], AppError> {
  const classes = new Map(
    referencias.classes.filter((classe) => classe.ativo).map((classe) => [classe.id, classe]),
  );
  const segmentos = new Map(
    referencias.segmentos
      .filter((segmento) => segmento.ativo)
      .map((segmento) => [segmento.id, segmento]),
  );

  const classe = validarEscopo("CLASSE", entrada.classe, classes, segmentos);
  if (!classe.ok) {
    return classe;
  }

  const segmento = validarEscopo("SEGMENTO", entrada.segmento, classes, segmentos);
  if (!segmento.ok) {
    return segmento;
  }

  return ok([...classe.value, ...segmento.value]);
}

/** Classifica o desvio em pontos percentuais com a tolerância de RN-090. */
export function classificarDesvio(desvioPontos: Decimal): SituacaoDesvio {
  if (desvioPontos.abs().lte(TOLERANCIA_DESVIO_PONTOS)) {
    return "DENTRO";
  }

  return desvioPontos.isNegative() ? "ABAIXO" : "ACIMA";
}

