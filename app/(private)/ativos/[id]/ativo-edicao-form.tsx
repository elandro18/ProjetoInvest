"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";

import { Button } from "@/src/components/ui/button";
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
  OPCOES_STATUS,
  ehClasseFii,
  formatarCnpj,
  mascararCnpj,
  mapaDeErrosDoAtivo,
  somenteDigitos,
  validarCnpjAtivo,
  validarNomeAtivo,
  validarObservacoes,
  validarTamanhoOpcional,
  type AtivoDetalheApi,
  type ClasseReferenciaApi,
  type ErrosAtivo,
  type StatusAtivo,
} from "../ativos-ui";

type CampoEdicao = Exclude<keyof ErrosAtivo, "ticker" | "classeId">;

const ORDEM_CAMPOS: readonly CampoEdicao[] = [
  "nome",
  "segmentoId",
  "cnpj",
  "administrador",
  "gestor",
  "fonteDados",
  "observacoes",
];

export interface AtivoEdicaoFormProps {
  readonly ativo: AtivoDetalheApi;
  /** `null` quando o catálogo não carregou: o segmento fica bloqueado e não é enviado. */
  readonly classes: readonly ClasseReferenciaApi[] | null;
  readonly onCancelar: () => void;
  readonly onSalvo: (atualizado: AtivoDetalheApi) => void;
  readonly onSessaoExpirada: () => void;
}

/**
 * Edição da ficha do ativo (UI_SPEC §6.3, RN-010-5).
 *
 * `ticker` e `classe` são imutáveis e aparecem desabilitados com explicação
 * (RN-015). O segmento só é editável quando o catálogo carregou; sem ele, os
 * demais campos continuam editáveis e o `PATCH` omite `segmentoId` para não
 * apagar o vínculo atual.
 */
export function AtivoEdicaoForm({
  ativo,
  classes,
  onCancelar,
  onSalvo,
  onSessaoExpirada,
}: AtivoEdicaoFormProps) {
  const nomeRef = useRef<HTMLInputElement>(null);
  const segmentoRef = useRef<HTMLSelectElement>(null);
  const cnpjRef = useRef<HTMLInputElement>(null);
  const administradorRef = useRef<HTMLInputElement>(null);
  const gestorRef = useRef<HTMLInputElement>(null);
  const fonteDadosRef = useRef<HTMLInputElement>(null);
  const observacoesRef = useRef<HTMLTextAreaElement>(null);

  const [nome, setNome] = useState(ativo.nome);
  const [segmentoId, setSegmentoId] = useState(ativo.segmento?.id ?? "");
  const [cnpj, setCnpj] = useState(ativo.cnpj === null ? "" : mascararCnpj(ativo.cnpj));
  const [administrador, setAdministrador] = useState(ativo.administrador ?? "");
  const [gestor, setGestor] = useState(ativo.gestor ?? "");
  const [fonteDados, setFonteDados] = useState(ativo.fonteDados ?? "");
  const [status, setStatus] = useState<StatusAtivo>(ativo.status);
  const [observacoes, setObservacoes] = useState(ativo.observacoes ?? "");

  const [erros, setErros] = useState<ErrosAtivo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const classe = classes?.find((item) => item.id === ativo.classe.id) ?? null;
  const exigeSegmento = ehClasseFii(classe);
  const segmentos = classe?.segmentos ?? [];
  const segmentoHabilitado = classes !== null && exigeSegmento && segmentos.length > 0;

  function refDoCampo(campo: CampoEdicao): RefObject<HTMLElement | null> {
    switch (campo) {
      case "nome":
        return nomeRef;
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

  function limparErro(campo: CampoEdicao) {
    setErros((atual) => {
      if (atual[campo] === undefined) {
        return atual;
      }
      const proximo = { ...atual };
      delete proximo[campo];
      return proximo;
    });
  }

  function validarCampo(campo: CampoEdicao): boolean {
    const mensagens: Record<CampoEdicao, string | null> = {
      nome: validarNomeAtivo(nome),
      segmentoId:
        segmentoHabilitado && segmentoId === "" ? "Informe o segmento para um FII." : null,
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
      onSessaoExpirada();
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

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);

    const validacoes = ORDEM_CAMPOS.map((campo) => validarCampo(campo));
    const primeiroInvalido = ORDEM_CAMPOS.find((_campo, indice) => !validacoes[indice]);
    if (primeiroInvalido !== undefined) {
      refDoCampo(primeiroInvalido).current?.focus();
      return;
    }

    const digitosCnpj = somenteDigitos(cnpj);
    const corpo: Record<string, unknown> = {
      nome: nome.trim(),
      cnpj: digitosCnpj === "" ? null : digitosCnpj,
      administrador: administrador.trim() === "" ? null : administrador.trim(),
      gestor: gestor.trim() === "" ? null : gestor.trim(),
      fonteDados: fonteDados.trim() === "" ? null : fonteDados.trim(),
      status,
      observacoes: observacoes.trim() === "" ? null : observacoes.trim(),
    };
    if (classes !== null && classe !== null) {
      corpo.segmentoId = exigeSegmento ? segmentoId || null : null;
    }

    setSalvando(true);
    try {
      const resultado = await apiRequest<AtivoDetalheApi>(`/api/ativos/${ativo.id}`, {
        method: "PATCH",
        body: corpo,
      });

      if (!resultado.ok) {
        tratarErro(resultado.error);
        return;
      }

      onSalvo(resultado.data);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form noValidate onSubmit={salvar} className="space-y-5" aria-busy={salvando}>
      {erroGeral === null ? null : <FormError>{erroGeral}</FormError>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Ticker"
          name="ticker"
          value={ativo.ticker}
          disabled
          hint="O ticker não pode ser alterado."
        />

        <SelectField
          label="Classe"
          name="classe"
          value={ativo.classe.id}
          disabled
          hint="A classe é imutável nesta versão."
          onChange={() => undefined}
        >
          <option value={ativo.classe.id}>{ativo.classe.nome}</option>
        </SelectField>

        <TextField
          ref={nomeRef}
          label="Nome"
          name="nome"
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
          ref={segmentoRef}
          label="Segmento"
          name="segmento"
          value={segmentoId}
          disabled={!segmentoHabilitado}
          error={erros.segmentoId}
          hint={
            classes === null
              ? "Segmentos indisponíveis agora. Os demais campos continuam editáveis."
              : classe === null
                ? "A classe deste ativo não está no catálogo ativo. O segmento atual será mantido."
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
          placeholder="00.000.000/0000-00"
          maxLength={CNPJ_MASCARADO_MAX}
          hint={`Opcional. Valor atual: ${formatarCnpj(ativo.cnpj)}.`}
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
          maxLength={FONTE_DADOS_MAX}
          hint="Provedor cadastrado que alimenta este ativo (ex.: cvm)."
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
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusAtivo)}
        >
          {OPCOES_STATUS.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
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
        <Button type="submit" carregando={salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Button>
        <Button variant="secondary" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
