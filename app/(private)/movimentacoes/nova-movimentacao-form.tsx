"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type RefObject } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { FormError } from "@/src/components/ui/form-error";
import { SelectField } from "@/src/components/ui/select-field";
import { TextareaField } from "@/src/components/ui/textarea-field";
import { TextField } from "@/src/components/ui/text-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
  type ApiError,
} from "@/src/lib/api-client";
import { ConfirmarPosicaoNegativaDialog } from "./confirmar-posicao-negativa-dialog";
import {
  OBSERVACOES_MAX,
  TIPOS_FORMULARIO,
  amanhaParaValidacao,
  ativoSelecionavel,
  calcularTotalPrevisto,
  compararTotal,
  decimalParaApi,
  exigeQuantidade,
  formatarMoeda,
  formatarNumeroDecimal,
  hojeParaValidacao,
  mapaDeErrosMovimentacao,
  posicaoNegativaDoErro,
  rotuloAtivo,
  rotuloTipo,
  validarCustos,
  validarDataMovimentacao,
  validarObservacoesMovimentacao,
  validarQuantidadeMovimentacao,
  validarValorTotalMovimentacao,
  validarValorUnitario,
  type AtivoOpcaoApi,
  type ImpactoPosicaoNegativa,
  type RespostaCriacaoMovimentacaoApi,
  type TipoMovimentacao,
} from "./movimentacoes-ui";

type CampoFormulario =
  | "ativoId"
  | "tipo"
  | "data"
  | "quantidade"
  | "valorUnitario"
  | "custos"
  | "valorTotal"
  | "observacoes";

const ORDEM_CAMPOS: readonly CampoFormulario[] = [
  "ativoId",
  "tipo",
  "data",
  "quantidade",
  "valorUnitario",
  "custos",
  "valorTotal",
  "observacoes",
];

type ErrosMovimentacao = Partial<Record<CampoFormulario, string>>;

interface CorpoMovimentacao {
  readonly ativoId: string;
  readonly tipo: TipoMovimentacao;
  readonly data: string;
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly valorTotal: string;
  readonly custos: string;
  readonly observacoes: string | null;
}

export interface NovaMovimentacaoFormProps {
  readonly aberto: boolean;
  readonly ativos: readonly AtivoOpcaoApi[];
  readonly carregandoAtivos: boolean;
  readonly erroAtivos: string | null;
  readonly onRecarregarAtivos: () => void;
  readonly onFechar: () => void;
  readonly onCriada: (resposta: RespostaCriacaoMovimentacaoApi) => void;
  readonly onSessaoExpirada: () => void;
}

/**
 * Cadastro de movimentação (UI_SPEC §7; RN-014, RN-018, RN-019).
 *
 * O total é calculado em tempo real (`quantidade × unitário + custos`) e o
 * campo é editável: quando diverge mais de R$ 0,01, a observação passa a ser
 * obrigatória e a tela avisa antes de salvar. Uma venda que deixaria a posição
 * negativa devolve 409; a tela então mostra o impacto e reenvia com
 * `confirmarPosicaoNegativa: true` e motivo (RN-018).
 */
export function NovaMovimentacaoForm({
  aberto,
  ativos,
  carregandoAtivos,
  erroAtivos,
  onRecarregarAtivos,
  onFechar,
  onCriada,
  onSessaoExpirada,
}: NovaMovimentacaoFormProps) {
  const ativoRef = useRef<HTMLSelectElement>(null);
  const tipoRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HTMLInputElement>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);
  const valorUnitarioRef = useRef<HTMLInputElement>(null);
  const custosRef = useRef<HTMLInputElement>(null);
  const valorTotalRef = useRef<HTMLInputElement>(null);
  const observacoesRef = useRef<HTMLTextAreaElement>(null);

  const [ativoId, setAtivoId] = useState("");
  const [tipo, setTipo] = useState<TipoMovimentacao>("COMPRA");
  const [data, setData] = useState(() => hojeParaValidacao());
  const [quantidade, setQuantidade] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [custos, setCustos] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [totalManual, setTotalManual] = useState(false);

  const [erros, setErros] = useState<ErrosMovimentacao>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [impacto, setImpacto] = useState<ImpactoPosicaoNegativa | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  const ativosElegiveis = ativos.filter(ativoSelecionavel);
  const calculado = calcularTotalPrevisto(quantidade, valorUnitario, custos);
  const divergencia =
    calculado === null ? null : compararTotal(valorTotal, calculado);
  const divergente = divergencia?.divergente === true;
  const ativoAtual = ativos.find((ativo) => ativo.id === ativoId);

  function refDoCampo(campo: CampoFormulario): RefObject<HTMLElement | null> {
    switch (campo) {
      case "ativoId":
        return ativoRef;
      case "data":
        return dataRef;
      case "quantidade":
        return quantidadeRef;
      case "valorUnitario":
        return valorUnitarioRef;
      case "custos":
        return custosRef;
      case "valorTotal":
        return valorTotalRef;
      case "observacoes":
        return observacoesRef;
      case "tipo":
        return tipoRef;
    }
  }

  function limparErro(campo: CampoFormulario) {
    setErros((atual) => {
      if (atual[campo] === undefined) {
        return atual;
      }
      const proximo = { ...atual };
      delete proximo[campo];
      return proximo;
    });
  }

  function validarCampo(campo: CampoFormulario): string | null {
    switch (campo) {
      case "ativoId":
        return ativoId === "" ? "Selecione o ativo." : null;
      case "tipo":
        return TIPOS_FORMULARIO.includes(tipo) ? null : "Selecione o tipo.";
      case "data":
        return validarDataMovimentacao(data);
      case "quantidade":
        return validarQuantidadeMovimentacao(quantidade, exigeQuantidade(tipo));
      case "valorUnitario":
        return validarValorUnitario(valorUnitario, exigeQuantidade(tipo));
      case "custos":
        return validarCustos(custos);
      case "valorTotal":
        return validarValorTotalMovimentacao(valorTotal);
      case "observacoes":
        return validarObservacoesMovimentacao(observacoes, divergente);
    }
  }

  function aplicarMensagem(campo: CampoFormulario, mensagem: string | null) {
    setErros((atual) => ({ ...atual, [campo]: mensagem ?? undefined }));
    return mensagem === null;
  }

  function validarTodos(): boolean {
    let valido = true;
    const proximos: ErrosMovimentacao = {};
    for (const campo of ORDEM_CAMPOS) {
      const mensagem = validarCampo(campo);
      if (mensagem !== null) {
        proximos[campo] = mensagem;
        valido = false;
      }
    }
    setErros(proximos);

    const primeiro = ORDEM_CAMPOS.find((campo) => proximos[campo] !== undefined);
    if (primeiro !== undefined) {
      refDoCampo(primeiro).current?.focus();
    }
    return valido;
  }

  function atualizarTotalAutomatico(
    novaQuantidade: string,
    novoValorUnitario: string,
    novosCustos: string,
  ) {
    if (totalManual) {
      return;
    }
    const previsto = calcularTotalPrevisto(novaQuantidade, novoValorUnitario, novosCustos);
    setValorTotal(previsto === null ? "" : formatarNumeroDecimal(previsto));
  }

  function limparFormulario() {
    setAtivoId("");
    setTipo("COMPRA");
    setData(hojeParaValidacao());
    setQuantidade("");
    setValorUnitario("");
    setCustos("");
    setValorTotal("");
    setObservacoes("");
    setTotalManual(false);
    setErros({});
    setErroGeral(null);
    setImpacto(null);
    setErroMotivo(null);
    setErroConfirmacao(null);
  }

  function fechar() {
    if (enviando || confirmando) {
      return;
    }
    limparFormulario();
    onFechar();
  }

  function corpoAtual(): CorpoMovimentacao | null {
    const quantidadeApi =
      quantidade.trim() === "" ? null : decimalParaApi(quantidade, 8);
    const valorUnitarioApi =
      valorUnitario.trim() === "" ? null : decimalParaApi(valorUnitario, 2, true);
    const valorTotalApi = decimalParaApi(valorTotal, 2, true);
    const custosApi = custos.trim() === "" ? "0.00" : decimalParaApi(custos, 2, true);

    if (quantidade.trim() !== "" && quantidadeApi === null) {
      return null;
    }
    if (valorUnitario.trim() !== "" && valorUnitarioApi === null) {
      return null;
    }
    if (valorTotalApi === null || custosApi === null) {
      return null;
    }

    return {
      ativoId,
      tipo,
      data,
      quantidade: quantidadeApi,
      valorUnitario: valorUnitarioApi,
      valorTotal: valorTotalApi,
      custos: custosApi,
      observacoes: observacoes.trim() === "" ? null : observacoes.trim(),
    };
  }

  function tratarErro(error: ApiError) {
    if (ehErroDeSessao(error)) {
      onSessaoExpirada();
      return;
    }

    const mapa = mapaDeErrosMovimentacao(error);
    const conhecidos = ORDEM_CAMPOS.filter((campo) => mapa[campo] !== undefined);
    if (conhecidos.length > 0) {
      const proximos: ErrosMovimentacao = {};
      for (const campo of conhecidos) {
        proximos[campo] = mapa[campo];
      }
      setErros(proximos);
      refDoCampo(conhecidos[0]).current?.focus();
      return;
    }

    const primeiraMensagem = Object.values(mapa)[0];
    setErroGeral(primeiraMensagem ?? mensagemDeErro(error));
  }

  async function enviarCorpo(corpo: CorpoMovimentacao) {
    setEnviando(true);
    try {
      const resultado = await apiRequest<RespostaCriacaoMovimentacaoApi>("/api/movimentacoes", {
        method: "POST",
        body: corpo,
      });

      if (!resultado.ok) {
        if (resultado.status === 409) {
          const detalhes = posicaoNegativaDoErro(resultado.error);
          if (detalhes !== null) {
            setErroMotivo(null);
            setErroConfirmacao(null);
            setImpacto(detalhes);
            return;
          }
        }
        tratarErro(resultado.error);
        return;
      }

      limparFormulario();
      onCriada(resultado.data);
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);

    if (!validarTodos()) {
      return;
    }

    const corpo = corpoAtual();
    if (corpo === null) {
      setErroGeral("Revise os valores numéricos informados.");
      return;
    }

    await enviarCorpo(corpo);
  }

  async function confirmarPosicaoNegativa(motivo: string) {
    const corpo = corpoAtual();
    if (corpo === null) {
      setErroConfirmacao("Revise os valores numéricos informados.");
      return;
    }

    setConfirmando(true);
    setErroMotivo(null);
    setErroConfirmacao(null);
    try {
      const resultado = await apiRequest<RespostaCriacaoMovimentacaoApi>("/api/movimentacoes", {
        method: "POST",
        body: { ...corpo, confirmarPosicaoNegativa: true, motivo },
      });

      if (!resultado.ok) {
        if (ehErroDeSessao(resultado.error)) {
          onSessaoExpirada();
          return;
        }

        const mapa = mapaDeErrosMovimentacao(resultado.error);
        if (mapa.motivo !== undefined) {
          setErroMotivo(mapa.motivo);
          return;
        }
        setErroConfirmacao(mensagemDeErro(resultado.error));
        return;
      }

      limparFormulario();
      onCriada(resultado.data);
    } finally {
      setConfirmando(false);
    }
  }

  if (!aberto) {
    return null;
  }

  if (impacto !== null) {
    return (
      <ConfirmarPosicaoNegativaDialog
        impacto={impacto}
        ativoTicker={ativoAtual?.ticker ?? "ativo"}
        enviando={confirmando}
        erroGeral={erroConfirmacao}
        erroMotivo={erroMotivo}
        onConfirmar={confirmarPosicaoNegativa}
        onVoltar={() => {
          setImpacto(null);
          setErroMotivo(null);
          setErroConfirmacao(null);
        }}
      />
    );
  }

  return (
    <Dialog
      open={aberto}
      title="Nova movimentação"
      onClose={fechar}
      initialFocusId="mov-ativo"
    >
      <form noValidate onSubmit={enviar} aria-busy={enviando} className="space-y-4">
        {erroGeral === null ? null : <FormError>{erroGeral}</FormError>}

        {erroAtivos === null ? null : (
          <Alert
            tone="warning"
            title="Não foi possível carregar os ativos"
            action={
              <Button variant="secondary" onClick={onRecarregarAtivos}>
                Tentar novamente
              </Button>
            }
          >
            <p>{erroAtivos}</p>
          </Alert>
        )}

        <SelectField
          ref={ativoRef}
          id="mov-ativo"
          label="Ativo"
          name="ativoId"
          value={ativoId}
          error={erros.ativoId}
          hint="Apenas ativos ativos e fora da renda fixa."
          disabled={carregandoAtivos}
          onChange={(event) => {
            setAtivoId(event.target.value);
            limparErro("ativoId");
          }}
          onBlur={() =>
            aplicarMensagem("ativoId", ativoId === "" ? "Selecione o ativo." : null)
          }
        >
          <option value="">
            {carregandoAtivos ? "Carregando ativos…" : "Selecione o ativo"}
          </option>
          {ativosElegiveis.map((ativo) => (
            <option key={ativo.id} value={ativo.id}>
              {rotuloAtivo(ativo)}
            </option>
          ))}
        </SelectField>

        {carregandoAtivos || erroAtivos !== null || ativosElegiveis.length > 0 ? null : (
          <Alert tone="warning" title="Nenhum ativo disponível">
            <p>
              Cadastre um ativo ativo (FII ou ação) antes de lançar movimentações. Aplicações e
              resgates de renda fixa são registrados no cadastro de renda fixa.
            </p>
            <Link href="/ativos" className="text-sm font-medium text-info hover:underline">
              Ir para Ativos
            </Link>
          </Alert>
        )}

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-neutral-900">Tipo</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS_FORMULARIO.map((opcao) => {
              const selecionado = tipo === opcao;
              return (
                <label
                  key={opcao}
                  className={[
                    "cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
                    selecionado
                      ? "border-neutral-900 bg-neutral-900 text-neutral-0"
                      : "border-neutral-200 bg-neutral-0 text-neutral-700 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <input
                    ref={opcao === "COMPRA" ? tipoRef : undefined}
                    type="radio"
                    name="tipo"
                    value={opcao}
                    checked={selecionado}
                    onChange={() => {
                      setTipo(opcao);
                      limparErro("tipo");
                      limparErro("quantidade");
                      limparErro("valorUnitario");
                      limparErro("observacoes");
                    }}
                    aria-describedby={erros.tipo === undefined ? undefined : "mov-tipo-erro"}
                    className="sr-only"
                  />
                  {rotuloTipo(opcao)}
                </label>
              );
            })}
          </div>
          {erros.tipo === undefined ? null : (
            <p id="mov-tipo-erro" role="alert" className="text-sm text-negative">
              {erros.tipo}
            </p>
          )}
          <p className="text-xs text-neutral-500">
            Aplicação e resgate de renda fixa não entram aqui (PEND-017): use o cadastro de renda
            fixa.
          </p>
        </fieldset>

        <TextField
          ref={dataRef}
          id="mov-data"
          label="Data"
          name="data"
          type="date"
          max={amanhaParaValidacao()}
          value={data}
          error={erros.data}
          hint="Aceita até amanhã."
          onChange={(event) => {
            setData(event.target.value);
            limparErro("data");
          }}
          onBlur={() => aplicarMensagem("data", validarDataMovimentacao(data))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            ref={quantidadeRef}
            id="mov-quantidade"
            label="Quantidade"
            name="quantidade"
            inputMode="decimal"
            autoComplete="off"
            placeholder="10"
            value={quantidade}
            error={erros.quantidade}
            hint={
              exigeQuantidade(tipo)
                ? "Obrigatória para compra e venda."
                : "Opcional neste tipo; quando informada, deve ser maior que zero."
            }
            onChange={(event) => {
              const valor = event.target.value;
              setQuantidade(valor);
              limparErro("quantidade");
              limparErro("observacoes");
              atualizarTotalAutomatico(valor, valorUnitario, custos);
            }}
            onBlur={() =>
              aplicarMensagem(
                "quantidade",
                validarQuantidadeMovimentacao(quantidade, exigeQuantidade(tipo)),
              )
            }
          />

          <TextField
            ref={valorUnitarioRef}
            id="mov-valor-unitario"
            label="Valor unitário (R$)"
            name="valorUnitario"
            inputMode="decimal"
            autoComplete="off"
            placeholder="100,00"
            value={valorUnitario}
            error={erros.valorUnitario}
            hint="Obrigatório para compra e venda."
            onChange={(event) => {
              const valor = event.target.value;
              setValorUnitario(valor);
              limparErro("valorUnitario");
              limparErro("observacoes");
              atualizarTotalAutomatico(quantidade, valor, custos);
            }}
            onBlur={() =>
              aplicarMensagem(
                "valorUnitario",
                validarValorUnitario(valorUnitario, exigeQuantidade(tipo)),
              )
            }
          />

          <TextField
            ref={custosRef}
            id="mov-custos"
            label="Custos (R$)"
            name="custos"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={custos}
            error={erros.custos}
            hint="Corretagem e emolumentos. Padrão 0,00."
            onChange={(event) => {
              const valor = event.target.value;
              setCustos(valor);
              limparErro("custos");
              limparErro("observacoes");
              atualizarTotalAutomatico(quantidade, valorUnitario, valor);
            }}
            onBlur={() => aplicarMensagem("custos", validarCustos(custos))}
          />

          <TextField
            ref={valorTotalRef}
            id="mov-valor-total"
            label="Valor total (R$)"
            name="valorTotal"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1.003,00"
            value={valorTotal}
            error={erros.valorTotal}
            hint="Editável: é o valor que será gravado na movimentação."
            onChange={(event) => {
              setValorTotal(event.target.value);
              setTotalManual(true);
              limparErro("valorTotal");
              limparErro("observacoes");
            }}
            onBlur={() => aplicarMensagem("valorTotal", validarValorTotalMovimentacao(valorTotal))}
          />
        </div>

        <div className="space-y-2" aria-live="polite">
          <p className="text-sm text-neutral-700">
            Calculado (quantidade × unitário + custos):{" "}
            <strong className="text-neutral-900">
              {calculado === null
                ? exigeQuantidade(tipo)
                  ? "Informe quantidade e valor unitário"
                  : "Não se aplica a este tipo — informe o valor total"
                : formatarMoeda(calculado)}
            </strong>
          </p>
          {totalManual && calculado !== null ? (
            <Button
              variant="ghost"
              onClick={() => {
                setTotalManual(false);
                setValorTotal(formatarNumeroDecimal(calculado));
                limparErro("valorTotal");
                limparErro("observacoes");
              }}
            >
              Usar valor calculado
            </Button>
          ) : null}
        </div>

        {divergente && divergencia !== null ? (
          <Alert tone="warning" title="Divergência de valor">
            <p>
              O valor total informado difere do calculado em {formatarMoeda(divergencia.diferenca)}.
              A observação é obrigatória para salvar.
            </p>
          </Alert>
        ) : null}

        <TextareaField
          ref={observacoesRef}
          id="mov-observacoes"
          label="Observações"
          name="observacoes"
          maxLength={OBSERVACOES_MAX}
          value={observacoes}
          error={erros.observacoes}
          hint={
            divergente && divergencia !== null
              ? `Obrigatória: diferença de ${formatarMoeda(divergencia.diferenca)} para o valor calculado.`
              : `Opcional, até ${OBSERVACOES_MAX} caracteres. Obrigatória quando o total divergir do cálculo.`
          }
          onChange={(event) => {
            setObservacoes(event.target.value);
            limparErro("observacoes");
          }}
          onBlur={() =>
            aplicarMensagem(
              "observacoes",
              validarObservacoesMovimentacao(observacoes, divergente),
            )
          }
        />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" carregando={enviando}>
            {enviando ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="secondary" onClick={fechar} disabled={enviando}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
