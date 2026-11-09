"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { ErrorState } from "@/src/components/ui/error-state";
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
  CNPJ_MASCARADO_MAX,
  FONTE_DADOS_MAX,
  NOME_ATIVO_MAX,
  OBSERVACOES_MAX,
  TICKER_MAX,
  TICKER_MIN,
  ehClasseFii,
  mascararCnpj,
  mapaDeErrosDoAtivo,
  somenteDigitos,
  validarCnpjAtivo,
  validarNomeAtivo,
  validarObservacoes,
  validarTamanhoOpcional,
  validarTicker,
  type AtivoDetalheApi,
  type ClasseReferenciaApi,
  type ErrosAtivo,
  type ReferenciaAtivosApi,
} from "../ativos-ui";

type CampoFormulario = keyof ErrosAtivo;

const ORDEM_CAMPOS: readonly CampoFormulario[] = [
  "ticker",
  "nome",
  "classeId",
  "segmentoId",
  "cnpj",
  "administrador",
  "gestor",
  "fonteDados",
  "observacoes",
];

const ESTILO_BOTAO_PRIMARIO =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-neutral-700";
const ESTILO_BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50";

/**
 * Cadastro de ativo (UI_SPEC §6.2, RN-010-4).
 *
 * A classe dirige o segmento: FII exige, renda fixa desabilita com explicação.
 * O CNPJ é mascarado e validado por DV; o status fica fixo em "Ativo" porque o
 * `POST /api/ativos` sempre cria ativo — a inativação é feita na ficha
 * (RN-013). Erros 422/409 marcam o campo, preservam o formulário e levam o
 * foco ao primeiro inválido (UI_SPEC §16).
 */
export function NovoAtivoView() {
  const router = useRouter();

  const tickerRef = useRef<HTMLInputElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const classeRef = useRef<HTMLSelectElement>(null);
  const segmentoRef = useRef<HTMLSelectElement>(null);
  const cnpjRef = useRef<HTMLInputElement>(null);
  const administradorRef = useRef<HTMLInputElement>(null);
  const gestorRef = useRef<HTMLInputElement>(null);
  const fonteDadosRef = useRef<HTMLInputElement>(null);
  const observacoesRef = useRef<HTMLTextAreaElement>(null);

  const [referencia, setReferencia] = useState<ReferenciaAtivosApi | null>(null);
  const [carregandoReferencia, setCarregandoReferencia] = useState(true);
  const [erroReferencia, setErroReferencia] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [tentativaReferencia, setTentativaReferencia] = useState(0);

  const [ticker, setTicker] = useState("");
  const [nome, setNome] = useState("");
  const [classeId, setClasseId] = useState("");
  const [segmentoId, setSegmentoId] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [administrador, setAdministrador] = useState("");
  const [gestor, setGestor] = useState("");
  const [fonteDados, setFonteDados] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [erros, setErros] = useState<ErrosAtivo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resultado = await apiRequest<ReferenciaAtivosApi>("/api/referencia/ativos", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (resultado.ok) {
          setReferencia(resultado.data);
          return;
        }

        if (ehErroDeSessao(resultado.error)) {
          setSessaoExpirada(true);
          setErroReferencia(resultado.error.message);
          return;
        }
        setErroReferencia(mensagemDeErro(resultado.error));
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === "AbortError") {
          return;
        }
        setErroReferencia("Não foi possível carregar classes e segmentos. Tente novamente.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoReferencia(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tentativaReferencia]);

  const classes: readonly ClasseReferenciaApi[] = referencia?.classes ?? [];
  const classeSelecionada = classes.find((classe) => classe.id === classeId) ?? null;
  const exigeSegmento = ehClasseFii(classeSelecionada);
  const segmentos = classeSelecionada?.segmentos ?? [];
  const segmentoHabilitado = exigeSegmento && segmentos.length > 0;

  function refDoCampo(campo: CampoFormulario): RefObject<HTMLElement | null> {
    switch (campo) {
      case "ticker":
        return tickerRef;
      case "nome":
        return nomeRef;
      case "classeId":
        return classeRef;
      case "segmentoId":
        return segmentoRef;
      case "cnpj":
        return cnpjRef;
      case "administrador":
        return administradorRef;
      case "gestor":
        return gestorRef;
      case "fonteDados":
        return fonteDadosRef;
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

  function validarCampo(campo: CampoFormulario): boolean {
    const mensagens: Record<CampoFormulario, string | null> = {
      ticker: validarTicker(ticker),
      nome: validarNomeAtivo(nome),
      classeId: classeId === "" ? "Selecione a classe." : null,
      segmentoId:
        exigeSegmento && segmentoId === "" ? "Informe o segmento para um FII." : null,
      cnpj: validarCnpjAtivo(cnpj),
      administrador: validarTamanhoOpcional(administrador, NOME_ATIVO_MAX, "O administrador"),
      gestor: validarTamanhoOpcional(gestor, NOME_ATIVO_MAX, "O gestor"),
      fonteDados: validarTamanhoOpcional(fonteDados, FONTE_DADOS_MAX, "A fonte de dados"),
      observacoes: validarObservacoes(observacoes),
    };
    const mensagem = mensagens[campo];
    setErros((atual) => ({ ...atual, [campo]: mensagem ?? undefined }));
    return mensagem === null;
  }

  function tratarErro(error: ApiError) {
    if (ehErroDeSessao(error)) {
      setSessaoExpirada(true);
      setErroGeral(error.message);
      return;
    }

    const mapa = mapaDeErrosDoAtivo(error);
    const primeiro = ORDEM_CAMPOS.find((campo) => mapa[campo] !== undefined);
    if (primeiro !== undefined) {
      setErros((atual) => {
        const proximo = { ...atual };
        for (const campo of ORDEM_CAMPOS) {
          if (mapa[campo] !== undefined) {
            proximo[campo] = mapa[campo];
          }
        }
        return proximo;
      });
      refDoCampo(primeiro).current?.focus();
      return;
    }

    setErroGeral(mensagemDeErro(error));
  }

  function tentarNovamenteReferencia() {
    setCarregandoReferencia(true);
    setErroReferencia(null);
    setSessaoExpirada(false);
    setTentativaReferencia((valor) => valor + 1);
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);

    const validacoes = ORDEM_CAMPOS.map((campo) => validarCampo(campo));
    const primeiroInvalido = ORDEM_CAMPOS.find((_campo, indice) => !validacoes[indice]);
    if (primeiroInvalido !== undefined) {
      refDoCampo(primeiroInvalido).current?.focus();
      return;
    }

    setEnviando(true);
    try {
      const digitosCnpj = somenteDigitos(cnpj);
      const resultado = await apiRequest<AtivoDetalheApi>("/api/ativos", {
        method: "POST",
        body: {
          ticker,
          nome: nome.trim(),
          classeId,
          segmentoId: exigeSegmento ? segmentoId : null,
          cnpj: digitosCnpj === "" ? null : digitosCnpj,
          administrador: administrador.trim() === "" ? null : administrador.trim(),
          gestor: gestor.trim() === "" ? null : gestor.trim(),
          fonteDados: fonteDados.trim() === "" ? null : fonteDados.trim(),
          observacoes: observacoes.trim() === "" ? null : observacoes.trim(),
        },
      });

      if (!resultado.ok) {
        tratarErro(resultado.error);
        return;
      }

      router.push(`/ativos?criado=${encodeURIComponent(resultado.data.ticker)}`);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  if (carregandoReferencia) {
    return (
      <div aria-busy="true" className="space-y-6">
        <span className="sr-only">Carregando formulário…</span>
        <div className="h-9 w-40 animate-pulse rounded-lg bg-neutral-200" />
        <div className="h-96 animate-pulse rounded-xl bg-neutral-200" />
      </div>
    );
  }

  if (sessaoExpirada || erroReferencia !== null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Novo ativo</h1>
        <ErrorState
          title={sessaoExpirada ? "Sessão expirada" : "Não foi possível carregar o formulário"}
          message={erroReferencia ?? "Dados de referência indisponíveis."}
          onRetry={sessaoExpirada ? undefined : tentarNovamenteReferencia}
          action={
            sessaoExpirada ? (
              <Link href="/login?callbackUrl=%2Fativos%2Fnovo" className={ESTILO_BOTAO_PRIMARIO}>
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Novo ativo</h1>
        <p className="text-sm text-neutral-700">
          Informe os dados cadastrais. Ticker e classe definem como o ativo será tratado nas
          próximas telas.
        </p>
      </div>

      {classes.length === 0 ? (
        <Alert tone="warning" title="Nenhuma classe disponível">
          <p>
            Não há classes ativas cadastradas. Tente novamente mais tarde ou fale com o suporte.
          </p>
        </Alert>
      ) : null}

      <form noValidate onSubmit={enviar} className="space-y-5" aria-busy={enviando}>
        {erroGeral === null ? null : <FormError>{erroGeral}</FormError>}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            ref={tickerRef}
            label="Ticker"
            name="ticker"
            autoComplete="off"
            spellCheck={false}
            maxLength={TICKER_MAX}
            hint={`De ${TICKER_MIN} a ${TICKER_MAX} caracteres alfanuméricos; sempre em maiúsculas.`}
            value={ticker}
            error={erros.ticker}
            onChange={(event) => {
              setTicker(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, TICKER_MAX),
              );
              limparErro("ticker");
            }}
            onBlur={() => validarCampo("ticker")}
          />

          <TextField
            ref={nomeRef}
            label="Nome"
            name="nome"
            autoComplete="off"
            maxLength={NOME_ATIVO_MAX}
            value={nome}
            error={erros.nome}
            onChange={(event) => {
              setNome(event.target.value);
              limparErro("nome");
            }}
            onBlur={() => validarCampo("nome")}
          />

          <SelectField
            ref={classeRef}
            label="Classe"
            name="classe"
            value={classeId}
            error={erros.classeId}
            onChange={(event) => {
              setClasseId(event.target.value);
              setSegmentoId("");
              setErros((atual) => ({ ...atual, classeId: undefined, segmentoId: undefined }));
            }}
            onBlur={() => validarCampo("classeId")}
          >
            <option value="">Selecione a classe</option>
            {classes.map((classe) => (
              <option key={classe.id} value={classe.id}>
                {classe.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            ref={segmentoRef}
            label="Segmento"
            name="segmento"
            value={segmentoId}
            disabled={!segmentoHabilitado}
            error={erros.segmentoId}
            hint={
              classeSelecionada === null
                ? "Selecione a classe para ver os segmentos disponíveis."
                : exigeSegmento
                  ? "Obrigatório para FII."
                  : "A classe selecionada não utiliza segmento."
            }
            onChange={(event) => {
              setSegmentoId(event.target.value);
              limparErro("segmentoId");
            }}
            onBlur={() => {
              if (segmentoHabilitado) {
                validarCampo("segmentoId");
              }
            }}
          >
            <option value="">Selecione o segmento</option>
            {segmentos.map((segmento) => (
              <option key={segmento.id} value={segmento.id}>
                {segmento.nome}
              </option>
            ))}
          </SelectField>

          <TextField
            ref={cnpjRef}
            label="CNPJ"
            name="cnpj"
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            maxLength={CNPJ_MASCARADO_MAX}
            hint="Opcional. Validamos os dois dígitos verificadores."
            value={cnpj}
            error={erros.cnpj}
            onChange={(event) => {
              setCnpj(mascararCnpj(event.target.value));
              limparErro("cnpj");
            }}
            onBlur={() => validarCampo("cnpj")}
          />

          <TextField
            ref={administradorRef}
            label="Administrador"
            name="administrador"
            autoComplete="off"
            maxLength={NOME_ATIVO_MAX}
            hint="Opcional."
            value={administrador}
            error={erros.administrador}
            onChange={(event) => {
              setAdministrador(event.target.value);
              limparErro("administrador");
            }}
            onBlur={() => validarCampo("administrador")}
          />

          <TextField
            ref={gestorRef}
            label="Gestor"
            name="gestor"
            autoComplete="off"
            maxLength={NOME_ATIVO_MAX}
            hint="Opcional."
            value={gestor}
            error={erros.gestor}
            onChange={(event) => {
              setGestor(event.target.value);
              limparErro("gestor");
            }}
            onBlur={() => validarCampo("gestor")}
          />

          <TextField
            ref={fonteDadosRef}
            label="Fonte de dados"
            name="fonteDados"
            autoComplete="off"
            maxLength={FONTE_DADOS_MAX}
            hint="Provedor cadastrado que alimentará este ativo (ex.: cvm)."
            value={fonteDados}
            error={erros.fonteDados}
            onChange={(event) => {
              setFonteDados(event.target.value);
              limparErro("fonteDados");
            }}
            onBlur={() => validarCampo("fonteDados")}
          />

          <SelectField
            label="Status"
            name="status"
            value="ATIVO"
            disabled
            hint="Todo novo ativo entra como Ativo. A inativação é feita na ficha do ativo."
            onChange={() => undefined}
          >
            <option value="ATIVO">Ativo</option>
          </SelectField>
        </div>

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
          onBlur={() => validarCampo("observacoes")}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" carregando={enviando} disabled={classes.length === 0}>
            {enviando ? "Salvando…" : "Salvar"}
          </Button>
          <Link href="/ativos" className={ESTILO_BOTAO_SECUNDARIO}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
