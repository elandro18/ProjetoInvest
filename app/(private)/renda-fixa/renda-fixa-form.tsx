"use client";

import {
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
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
import {
  INSTITUICAO_MAX,
  OBSERVACOES_MAX,
  OPCOES_INDEXADOR,
  OPCOES_LIQUIDEZ,
  OPCOES_PRODUTO,
  OPCOES_STATUS_SALDO,
  decimalParaApi,
  derivarCoberturaFgc,
  hojeParaValidacao,
  mapaDeErrosRendaFixa,
  rotuloProduto,
  validarCarenciaRendaFixa,
  validarDataAplicacaoRendaFixa,
  validarInstituicao,
  validarObservacoesRendaFixa,
  validarSaldoRendaFixa,
  validarTaxaRendaFixa,
  validarValorAplicadoRendaFixa,
  validarVencimentoRendaFixa,
  type IndexadorRendaFixa,
  type LiquidezRendaFixa,
  type ProdutoRendaFixa,
  type RendaFixaApi,
  type StatusSaldo,
} from "./renda-fixa-ui";

type CampoFormulario =
  | "instituicao"
  | "produto"
  | "indexador"
  | "taxa"
  | "dataAplicacao"
  | "vencimento"
  | "valorAplicado"
  | "saldoAtual"
  | "liquidez"
  | "carenciaAte"
  | "observacoes";

const ORDEM_CAMPOS: readonly CampoFormulario[] = [
  "instituicao",
  "produto",
  "indexador",
  "taxa",
  "dataAplicacao",
  "vencimento",
  "valorAplicado",
  "saldoAtual",
  "liquidez",
  "carenciaAte",
  "observacoes",
];

type ErrosRendaFixa = Partial<Record<CampoFormulario, string>>;

export interface RendaFixaFormProps {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly onCriado: (titulo: RendaFixaApi) => void;
  readonly onSessaoExpirada: () => void;
}

/**
 * Cadastro de título de renda fixa (UI_SPEC §8, RN-057-4).
 *
 * `coberturaFgc` nasce derivada do produto (CDB/LCI/LCA = coberta) e pode ser
 * sobrescrita; um override explícito só é desfeito por ação do titular. A
 * validação local antecipa datas, taxa e valores do contrato
 * (API_CONTRACTS.md §6.2) e o 422 do servidor marca o campo sem descartar o
 * preenchimento (UI_SPEC §16).
 */
export function RendaFixaForm({
  aberto,
  onFechar,
  onCriado,
  onSessaoExpirada,
}: RendaFixaFormProps) {
  const instituicaoRef = useRef<HTMLInputElement>(null);
  const produtoRef = useRef<HTMLSelectElement>(null);
  const indexadorRef = useRef<HTMLSelectElement>(null);
  const taxaRef = useRef<HTMLInputElement>(null);
  const dataAplicacaoRef = useRef<HTMLInputElement>(null);
  const vencimentoRef = useRef<HTMLInputElement>(null);
  const valorAplicadoRef = useRef<HTMLInputElement>(null);
  const saldoAtualRef = useRef<HTMLInputElement>(null);
  const liquidezRef = useRef<HTMLSelectElement>(null);
  const carenciaRef = useRef<HTMLInputElement>(null);
  const observacoesRef = useRef<HTMLTextAreaElement>(null);

  const [instituicao, setInstituicao] = useState("");
  const [produto, setProduto] = useState<ProdutoRendaFixa | "">("");
  const [indexador, setIndexador] = useState<IndexadorRendaFixa | "">("");
  const [taxa, setTaxa] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [valorAplicado, setValorAplicado] = useState("");
  const [saldoAtual, setSaldoAtual] = useState("");
  const [statusSaldo, setStatusSaldo] = useState<StatusSaldo>("INFORMADO");
  const [liquidez, setLiquidez] = useState<LiquidezRendaFixa | "">("");
  const [carenciaAte, setCarenciaAte] = useState("");
  const [coberturaFgc, setCoberturaFgc] = useState(false);
  const [coberturaPersonalizada, setCoberturaPersonalizada] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const [erros, setErros] = useState<ErrosRendaFixa>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function refDoCampo(campo: CampoFormulario): RefObject<HTMLElement | null> {
    switch (campo) {
      case "instituicao":
        return instituicaoRef;
      case "produto":
        return produtoRef;
      case "indexador":
        return indexadorRef;
      case "taxa":
        return taxaRef;
      case "dataAplicacao":
        return dataAplicacaoRef;
      case "vencimento":
        return vencimentoRef;
      case "valorAplicado":
        return valorAplicadoRef;
      case "saldoAtual":
        return saldoAtualRef;
      case "liquidez":
        return liquidezRef;
      case "carenciaAte":
        return carenciaRef;
      case "observacoes":
        return observacoesRef;
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
      case "instituicao":
        return validarInstituicao(instituicao);
      case "produto":
        return produto === "" ? "Selecione o produto." : null;
      case "indexador":
        return indexador === "" ? "Selecione o indexador." : null;
      case "taxa":
        return validarTaxaRendaFixa(taxa);
      case "dataAplicacao":
        return validarDataAplicacaoRendaFixa(dataAplicacao);
      case "vencimento":
        return validarVencimentoRendaFixa(vencimento, dataAplicacao);
      case "valorAplicado":
        return validarValorAplicadoRendaFixa(valorAplicado);
      case "saldoAtual":
        return validarSaldoRendaFixa(saldoAtual);
      case "liquidez":
        return liquidez === "" ? "Selecione a liquidez." : null;
      case "carenciaAte":
        return validarCarenciaRendaFixa(carenciaAte, dataAplicacao);
      case "observacoes":
        return validarObservacoesRendaFixa(observacoes);
    }
  }

  function aplicarMensagem(campo: CampoFormulario, mensagem: string | null) {
    setErros((atual) => ({ ...atual, [campo]: mensagem ?? undefined }));
    return mensagem === null;
  }

  function validarTodos(): boolean {
    let valido = true;
    const proximos: ErrosRendaFixa = {};
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

  function limparFormulario() {
    setInstituicao("");
    setProduto("");
    setIndexador("");
    setTaxa("");
    setDataAplicacao("");
    setVencimento("");
    setValorAplicado("");
    setSaldoAtual("");
    setStatusSaldo("INFORMADO");
    setLiquidez("");
    setCarenciaAte("");
    setCoberturaFgc(false);
    setCoberturaPersonalizada(false);
    setObservacoes("");
    setErros({});
    setErroGeral(null);
  }

  function fechar() {
    if (enviando) {
      return;
    }
    limparFormulario();
    onFechar();
  }

  function tratarErro(error: ApiError) {
    if (ehErroDeSessao(error)) {
      onSessaoExpirada();
      return;
    }

    const mapa = mapaDeErrosRendaFixa(error);
    const primeiro = ORDEM_CAMPOS.find((campo) => mapa[campo] !== undefined);
    if (primeiro !== undefined) {
      const proximos: ErrosRendaFixa = {};
      for (const campo of ORDEM_CAMPOS) {
        if (mapa[campo] !== undefined) {
          proximos[campo] = mapa[campo];
        }
      }
      setErros(proximos);
      refDoCampo(primeiro).current?.focus();
      return;
    }

    setErroGeral(mensagemDeErro(error));
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);

    if (!validarTodos()) {
      return;
    }

    const taxaApi = decimalParaApi(taxa, 6);
    const valorApi = decimalParaApi(valorAplicado, 2, true);
    const saldoApi = decimalParaApi(saldoAtual, 2, true);
    if (taxaApi === null || valorApi === null || saldoApi === null) {
      setErroGeral("Revise os valores numéricos informados.");
      return;
    }

    if (produto === "" || indexador === "" || liquidez === "") {
      setErroGeral("Revise os campos de seleção.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await apiRequest<RendaFixaApi>("/api/renda-fixa", {
        method: "POST",
        body: {
          instituicao: instituicao.trim(),
          produto,
          indexador,
          taxa: taxaApi,
          dataAplicacao,
          vencimento: vencimento === "" ? null : vencimento,
          valorAplicado: valorApi,
          saldoAtual: saldoApi,
          statusSaldo,
          liquidez,
          carenciaAte: carenciaAte === "" ? null : carenciaAte,
          coberturaFgc,
          observacoes: observacoes.trim() === "" ? null : observacoes.trim(),
        },
      });

      if (!resultado.ok) {
        tratarErro(resultado.error);
        return;
      }

      limparFormulario();
      onCriado(resultado.data);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      title="Cadastrar título"
      onClose={fechar}
      initialFocusId="rf-instituicao"
    >
      <form noValidate onSubmit={enviar} aria-busy={enviando} className="space-y-4">
        {erroGeral === null ? null : <FormError>{erroGeral}</FormError>}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            ref={instituicaoRef}
            id="rf-instituicao"
            label="Instituição"
            name="instituicao"
            autoComplete="off"
            maxLength={INSTITUICAO_MAX}
            value={instituicao}
            error={erros.instituicao}
            onChange={(event) => {
              setInstituicao(event.target.value);
              limparErro("instituicao");
            }}
            onBlur={() => aplicarMensagem("instituicao", validarInstituicao(instituicao))}
          />

          <SelectField
            ref={produtoRef}
            label="Produto"
            name="produto"
            value={produto}
            error={erros.produto}
            onChange={(event) => {
              const selecionado = event.target.value as ProdutoRendaFixa | "";
              setProduto(selecionado);
              limparErro("produto");
              if (selecionado !== "" && !coberturaPersonalizada) {
                setCoberturaFgc(derivarCoberturaFgc(selecionado));
              }
            }}
            onBlur={() => aplicarMensagem("produto", produto === "" ? "Selecione o produto." : null)}
          >
            <option value="">Selecione o produto</option>
            {OPCOES_PRODUTO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>

          <SelectField
            ref={indexadorRef}
            label="Indexador"
            name="indexador"
            value={indexador}
            error={erros.indexador}
            onChange={(event) => {
              setIndexador(event.target.value as IndexadorRendaFixa | "");
              limparErro("indexador");
            }}
            onBlur={() =>
              aplicarMensagem("indexador", indexador === "" ? "Selecione o indexador." : null)
            }
          >
            <option value="">Selecione o indexador</option>
            {OPCOES_INDEXADOR.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>

          <TextField
            ref={taxaRef}
            label="Taxa (% a.a.)"
            name="taxa"
            inputMode="decimal"
            autoComplete="off"
            placeholder="12,5"
            value={taxa}
            error={erros.taxa}
            hint="Percentual ao ano, entre 0 e 100. Use vírgula para decimais."
            onChange={(event) => {
              setTaxa(event.target.value);
              limparErro("taxa");
            }}
            onBlur={() => aplicarMensagem("taxa", validarTaxaRendaFixa(taxa))}
          />

          <TextField
            ref={dataAplicacaoRef}
            label="Data de aplicação"
            name="dataAplicacao"
            type="date"
            max={hojeParaValidacao()}
            value={dataAplicacao}
            error={erros.dataAplicacao}
            onChange={(event) => {
              setDataAplicacao(event.target.value);
              limparErro("dataAplicacao");
              limparErro("vencimento");
              limparErro("carenciaAte");
            }}
            onBlur={() =>
              aplicarMensagem("dataAplicacao", validarDataAplicacaoRendaFixa(dataAplicacao))
            }
          />

          <TextField
            ref={vencimentoRef}
            label="Vencimento"
            name="vencimento"
            type="date"
            min={dataAplicacao === "" ? undefined : dataAplicacao}
            value={vencimento}
            error={erros.vencimento}
            hint="Opcional. Precisa ser posterior à aplicação."
            onChange={(event) => {
              setVencimento(event.target.value);
              limparErro("vencimento");
            }}
            onBlur={() =>
              aplicarMensagem("vencimento", validarVencimentoRendaFixa(vencimento, dataAplicacao))
            }
          />

          <TextField
            ref={valorAplicadoRef}
            label="Valor aplicado (R$)"
            name="valorAplicado"
            inputMode="decimal"
            autoComplete="off"
            placeholder="10.000,00"
            value={valorAplicado}
            error={erros.valorAplicado}
            hint="Use vírgula para centavos."
            onChange={(event) => {
              setValorAplicado(event.target.value);
              limparErro("valorAplicado");
            }}
            onBlur={() =>
              aplicarMensagem("valorAplicado", validarValorAplicadoRendaFixa(valorAplicado))
            }
          />

          <TextField
            ref={saldoAtualRef}
            label="Saldo atual (R$)"
            name="saldoAtual"
            inputMode="decimal"
            autoComplete="off"
            placeholder="10.450,00"
            value={saldoAtual}
            error={erros.saldoAtual}
            hint="Saldo informado pelo titular; não é calculado pelo sistema."
            onChange={(event) => {
              setSaldoAtual(event.target.value);
              limparErro("saldoAtual");
            }}
            onBlur={() => aplicarMensagem("saldoAtual", validarSaldoRendaFixa(saldoAtual))}
          />

          <SelectField
            label="Status do saldo"
            name="statusSaldo"
            value={statusSaldo}
            onChange={(event) => setStatusSaldo(event.target.value as StatusSaldo)}
          >
            {OPCOES_STATUS_SALDO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>

          <SelectField
            ref={liquidezRef}
            label="Liquidez"
            name="liquidez"
            value={liquidez}
            error={erros.liquidez}
            onChange={(event) => {
              setLiquidez(event.target.value as LiquidezRendaFixa | "");
              limparErro("liquidez");
            }}
            onBlur={() =>
              aplicarMensagem("liquidez", liquidez === "" ? "Selecione a liquidez." : null)
            }
          >
            <option value="">Selecione a liquidez</option>
            {OPCOES_LIQUIDEZ.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </SelectField>

          <TextField
            ref={carenciaRef}
            label="Carência até"
            name="carenciaAte"
            type="date"
            min={dataAplicacao === "" ? undefined : dataAplicacao}
            value={carenciaAte}
            error={erros.carenciaAte}
            hint="Opcional. Nunca anterior à aplicação."
            onChange={(event) => {
              setCarenciaAte(event.target.value);
              limparErro("carenciaAte");
            }}
            onBlur={() =>
              aplicarMensagem("carenciaAte", validarCarenciaRendaFixa(carenciaAte, dataAplicacao))
            }
          />
        </div>

        <Checkbox
          label={
            <>
              Cobertura FGC{" "}
              <span className="text-neutral-500">
                (derivada do produto — CDB, LCI e LCA vêm cobertas; marque ou desmarque para
                sobrescrever)
              </span>
            </>
          }
          checked={coberturaFgc}
          onChange={(event) => {
            setCoberturaPersonalizada(true);
            setCoberturaFgc(event.target.checked);
          }}
        />

        <TextareaField
          ref={observacoesRef}
          label="Observações"
          name="observacoes"
          maxLength={OBSERVACOES_MAX}
          hint={`Opcional, até ${OBSERVACOES_MAX} caracteres.`}
          value={observacoes}
          error={erros.observacoes}
          onChange={(event) => {
            setObservacoes(event.target.value);
            limparErro("observacoes");
          }}
          onBlur={() =>
            aplicarMensagem("observacoes", validarObservacoesRendaFixa(observacoes))
          }
        />

        {produto === "" ? null : (
          <Alert tone="info" title={`Cobertura FGC: ${coberturaFgc ? "sim" : "não"}`}>
            <p>
              {coberturaFgc
                ? `O produto ${rotuloProduto(produto)} é tratado como coberto pelo FGC.`
                : `O produto ${rotuloProduto(produto)} é tratado como sem cobertura do FGC.`}{" "}
              A regra é uma estimativa e pode ser sobrescrita no campo acima.
            </p>
          </Alert>
        )}

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
