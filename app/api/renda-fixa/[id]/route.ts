import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosRendaFixa } from "@/src/infra/container/renda-fixa";
import { withRoute, type RouteContext } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { readJsonBody, validate } from "@/src/infra/http/validation";
import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { apresentarRendaFixa } from "@/src/modules/renda-fixa/apresentacao";
import {
  atualizarRendaFixa,
  validarCamposImutaveis,
} from "@/src/modules/renda-fixa/atualizar-renda-fixa";
import { dataIsoValida } from "@/src/modules/renda-fixa/datas";
import {
  LIQUIDEZ_RENDA_FIXA,
  STATUS_SALDO,
} from "@/src/modules/renda-fixa/repositorio";

/**
 * `PATCH /api/renda-fixa/{id}` — autenticado (API_CONTRACTS.md §6.3;
 * RN-057-2). ID inválido ou de outro titular é sempre `RF_NAO_ENCONTRADA`
 * (404), nunca 403. Produto/indexador/taxa/data de aplicação/valor aplicado/
 * vencimento são imutáveis (`RF_CAMPO_IMUTAVEL`).
 */

export const dynamic = "force-dynamic";

interface ParametrosRendaFixa {
  readonly id?: unknown;
}

const dataIso = z.string().refine(dataIsoValida, "Data inválida (use YYYY-MM-DD).");

const atualizarRendaFixaSchema = z.strictObject({
  saldoAtual: z.string().trim().min(1).max(30).optional(),
  statusSaldo: z.enum(STATUS_SALDO).optional(),
  liquidez: z.enum(LIQUIDEZ_RENDA_FIXA).optional(),
  carenciaAte: dataIso.nullable().optional(),
  coberturaFgc: z.boolean().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

async function idDaRota(context: RouteContext): Promise<string> {
  const params = context.params as
    | Promise<ParametrosRendaFixa>
    | ParametrosRendaFixa
    | undefined;
  const resolvidos = await params;
  const id = resolvidos?.id;

  if (typeof id !== "string" || !z.uuid().safeParse(id).success) {
    throw errors.rfNaoEncontrada();
  }
  return id;
}

export const PATCH = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const id = await idDaRota(context);

  const corpo = await readJsonBody(request);
  const imutavel = validarCamposImutaveis(corpo);
  if (imutavel !== null) {
    throw imutavel;
  }

  const campos = validate(atualizarRendaFixaSchema, corpo);
  const resultado = await atualizarRendaFixa(
    { usuarioId: usuario.usuarioId, id, ...campos },
    servicosRendaFixa(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarRendaFixa(resultado.value), 200, context.requestId);
});
