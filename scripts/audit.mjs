#!/usr/bin/env node
/**
 * Auditoria de dependências com allowlist explícita (RN-001-6).
 *
 * Regra: qualquer vulnerabilidade `high` ou `critical` bloqueia o CI, exceto
 * as que estiverem listadas abaixo com motivo e prazo de revisão. Every
 * exception must have a corresponding ADR em `docs/InvestmentControl/DECISIONS.md`.
 */
import { execSync } from "node:child_process";

/** Advisories aceitas de forma consciente. Chave = ID GHSA. */
const ALLOWLIST = {
  "GHSA-ggr8-5vv4-36mx": {
    motivo:
      "deepmerge-ts < 8 via @prisma/config (CLI do Prisma 6). Não é alcançável em runtime pela aplicação; correção exige Prisma 7 (ADR-012).",
    revisarAte: "2027-02-01",
  },
};

const SEVERIDADES_BLOQUEANTES = new Set(["high", "critical"]);

function executarAudit() {
  try {
    // `execSync` resolve `npm`/`npm.cmd` pelo shell em todas as plataformas.
    const saida = execSync("npm audit --json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(saida);
  } catch (erro) {
    // npm audit retorna código != 0 quando encontra vulnerabilidade; o JSON
    // continua disponível no stdout.
    if (erro && typeof erro.stdout === "string" && erro.stdout.length > 0) {
      return JSON.parse(erro.stdout);
    }
    throw erro;
  }
}

function principal() {
  const relatorio = executarAudit();
  const achados = [];

  for (const vulnerabilidade of Object.values(relatorio.vulnerabilities ?? {})) {
    if (!SEVERIDADES_BLOQUEANTES.has(vulnerabilidade.severity)) continue;

    const advisories = (vulnerabilidade.via ?? []).filter(
      (via) => typeof via === "object" && via !== null && typeof via.url === "string",
    );

    // Quando `via` só tem strings, a vulnerabilidade é propagação de outro
    // pacote — o advisory raiz já é avaliado na própria entrada.
    if (advisories.length === 0) continue;

    for (const advisory of advisories) {
      const id = /GHSA-[A-Za-z0-9-]+/.exec(advisory.url)?.[0] ?? advisory.url;
      achados.push({
        pacote: vulnerabilidade.name,
        severidade: vulnerabilidade.severity,
        id,
        titulo: advisory.title ?? advisory.name ?? "sem título",
      });
    }
  }

  const aceitos = achados.filter((achado) => achado.id in ALLOWLIST);
  const bloqueantes = achados.filter((achado) => !(achado.id in ALLOWLIST));

  for (const achado of aceitos) {
    const excecao = ALLOWLIST[achado.id];
    console.log(
      `ACEITO   ${achado.severidade.padEnd(8)} ${achado.pacote} ${achado.id} — ${excecao.motivo} (revisar até ${excecao.revisarAte})`,
    );
  }

  for (const achado of bloqueantes) {
    console.error(
      `BLOQUEIA ${achado.severidade.padEnd(8)} ${achado.pacote} ${achado.id} — ${achado.titulo}`,
    );
  }

  if (bloqueantes.length > 0) {
    console.error(
      `\n${bloqueantes.length} vulnerabilidade(s) alta(s)/crítica(s) fora da allowlist.`,
    );
    process.exit(1);
  }

  console.log(
    `\nAuditoria OK — ${aceitos.length} aceite(s) explícito(s), 0 bloqueio(s).`,
  );
}

principal();
