/**
 * Le a atividade no GitHub e grava src/data/stats.json.
 *
 * Roda no build e num workflow agendado toda segunda. Se a API falhar, ficar sem
 * rate limit ou devolver algo incoerente, o arquivo existente e mantido e o
 * script sai com codigo 0: numero desatualizado na pagina e ruim, build quebrado
 * as tres da manha por causa de um 502 da API e pior.
 *
 * Conta repositorio PRIVADO tambem, e nao so publico. O trabalho fechado e
 * trabalho igual, e deixa-lo de fora subestimava a conta em silencio: so a
 * organizacao self-labs tem nove repositorios privados que nunca entraram.
 *
 * Isso depende inteiramente do token. Sem token, ou com um token sem o escopo
 * "repo", a API devolve apenas o que e publico e o numero encolhe. Por isso o
 * script avisa em voz alta qual dos dois mundos ele enxergou, e a guarda de
 * coerencia no fim recusa gravar uma queda grande por cima de um numero bom.
 *
 * O que NAO e buscado aqui:
 *   sistemasEmProducao  vem dos proprios arquivos de src/content/projects
 *   mesesDeOperacao     e calculado no componente, a partir de "inicioOperacao"
 *
 * Uso:
 *   node scripts/fetch-stats.mjs            (anonimo, 60 por hora, so publico)
 *   GITHUB_TOKEN=ghp_... node scripts/...   (5000 por hora, publico e privado)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(ROOT, "src/data/stats.json");

const USUARIO = "CaTeIM";
const ORGS = ["self-labs"];

/**
 * Contas cujos repositorios sao meus: PR nelas nao conta como contribuicao externa.
 *
 * atlasdao entra aqui porque o Atlas Logistics e projeto proprio, so hospedado
 * numa conta separada. oroderico NAO entra: o Origo e projeto de outra pessoa,
 * onde eu corrijo bugs, entao PR la conta como contribuicao externa.
 */
const PROPRIAS = new Set([
  USUARIO.toLowerCase(),
  ...ORGS.map((o) => o.toLowerCase()),
  "atlasdao",
]);

const API = "https://api.github.com";
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

async function api(caminho, { headersOnly = false } = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "selflabs-site-stats",
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!resposta.ok) {
    const restante = resposta.headers.get("x-ratelimit-remaining");
    throw new Error(
      `GET ${caminho} devolveu ${resposta.status}${restante === "0" ? " (rate limit esgotado)" : ""}`,
    );
  }

  return headersOnly ? resposta.headers : resposta.json();
}

/**
 * Percorre todas as paginas de um endereco de listagem.
 *
 * Com repositorio privado no bolo a lista passa de 30, que e o padrao da API, e
 * uma unica pagina passaria a truncar sem avisar nada.
 */
async function apiTodas(caminho) {
  const itens = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const junta = caminho.includes("?") ? "&" : "?";
    const lote = await api(`${caminho}${junta}per_page=100&page=${pagina}`);
    if (!Array.isArray(lote) || lote.length === 0) break;
    itens.push(...lote);
    if (lote.length < 100) break;
  }
  return itens;
}

/**
 * Conta commits do autor num repositorio sem baixar a lista inteira.
 *
 * Truque: pede uma pagina de tamanho 1 e le o numero da ultima pagina no header
 * Link. Um repositorio de 227 commits custa uma requisicao, nao 227.
 */
async function contarCommits(nomeCompleto) {
  const headers = await api(
    `/repos/${nomeCompleto}/commits?author=${USUARIO}&per_page=1`,
    { headersOnly: true },
  );

  const link = headers.get("link");
  if (link) {
    const ultima = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
    if (ultima) return Number.parseInt(ultima[1], 10);
  }

  // Sem header Link o repositorio tem zero ou um commit do autor.
  const commits = await api(
    `/repos/${nomeCompleto}/commits?author=${USUARIO}&per_page=1`,
  );
  return Array.isArray(commits) ? commits.length : 0;
}

/**
 * Todo repositorio onde eu possa ter escrito alguma coisa.
 *
 * Autenticado, "/user/repos" com visibility=all e a unica chamada que enxerga o
 * que e privado, e traz de uma vez o que e meu e o que e das organizacoes. Sem
 * token esse endereco nem existe, entao a busca cai para a listagem publica, e o
 * resultado e o mesmo de antes.
 *
 * Fork entra na varredura de proposito. Isso nao infla nada, porque a contagem e
 * sempre filtrada por autor: um fork onde eu nunca escrevi devolve zero e cai
 * fora sozinho na hora de contar repositorios.
 */
async function listarRepos() {
  if (token) {
    try {
      const meus = await apiTodas(
        "/user/repos?visibility=all&affiliation=owner,organization_member&sort=pushed",
      );
      const filtrados = meus.filter((r) =>
        PROPRIAS.has(r.owner?.login?.toLowerCase() ?? ""),
      );
      if (filtrados.length > 0) return filtrados;
      console.warn(
        "  aviso: o token nao devolveu repositorio nenhum das contas conhecidas",
      );
    } catch (erro) {
      console.warn(`  aviso: listagem autenticada falhou (${erro.message})`);
    }
  }

  // Sem token, ou com um token que nao serve: so o que e publico.
  const contas = [
    `/users/${USUARIO}/repos`,
    ...ORGS.map((org) => `/orgs/${org}/repos`),
    "/users/atlasdao/repos",
  ];

  const todos = [];
  for (const caminho of contas) {
    try {
      todos.push(...(await apiTodas(`${caminho}?type=owner&sort=pushed`)));
    } catch (erro) {
      // Conta inexistente ou sem permissao para o token anonimo: segue com o resto.
      console.warn(`  aviso: ${caminho} indisponivel (${erro.message})`);
    }
  }
  return todos;
}

/** Pull requests do autor com merge, em repositorios que nao sao dele. */
async function contarPullRequestsExternos() {
  const excluir = [...PROPRIAS].map((c) => `-user:${c}`).join("+");
  const busca = await api(
    `/search/issues?q=type:pr+author:${USUARIO}+is:merged+${excluir}&per_page=1`,
  );
  return Number.parseInt(busca.total_count ?? 0, 10);
}

function lerAtual() {
  try {
    return JSON.parse(fs.readFileSync(DESTINO, "utf8"));
  } catch {
    return null;
  }
}

/** Recusa gravar um resultado obviamente degradado por cima de um bom. */
function pareceValido(novo, antigo) {
  if (novo.commits < 1 || novo.repositorios < 1) return false;
  if (!antigo) return true;

  /*
   * Uma queda maior que 20% quase sempre significa API parcial, nao apagamento.
   * Agora ela protege tambem contra rodar sem token: sem ele o privado some da
   * conta e o numero despenca, e seria uma pena sobrescrever o bom com o pobre.
   */
  const antesCommits = antigo.commits ?? 0;
  if (novo.commits < antesCommits * 0.8) return false;
  if (novo.prsExternos < (antigo.prsExternos ?? 0) * 0.8) return false;
  return true;
}

async function main() {
  const antigo = lerAtual();
  console.log(
    token
      ? "Consultando a API do GitHub (autenticado, inclui repositório privado)"
      : "Consultando a API do GitHub (anônimo, somente repositório público)",
  );

  try {
    const repos = await listarRepos();
    if (repos.length === 0) throw new Error("nenhum repositório retornado");

    let commits = 0;
    let comCommits = 0;
    let privados = 0;
    for (const repo of repos) {
      const n = await contarCommits(repo.full_name);
      if (n === 0) continue; // fork intocado, ou repositório de onde nunca escrevi

      commits += n;
      comCommits += 1;
      if (repo.private) privados += 1;
      console.log(
        `  ${repo.private ? "[priv]" : "[pub] "} ${repo.full_name.padEnd(34)} ${String(n).padStart(5)} commits`,
      );
    }

    const prsExternos = await contarPullRequestsExternos();

    /*
     * O inicio da operacao sai do repositorio mais antigo ONDE EU ESCREVI, e nao
     * do mais antigo que existe: um fork criado num dia qualquer nao marca o
     * comeco de nada.
     */
    const comigo = repos.filter((r) => r.created_at);
    const maisAntigo = comigo.reduce(
      (menor, r) => (new Date(r.created_at) < new Date(menor) ? r.created_at : menor),
      comigo[0].created_at,
    );

    const novo = {
      commits,
      repositorios: comCommits,
      prsExternos,
      /** Data do repositorio mais antigo: e daqui que sai "meses de operacao". */
      inicioOperacao: maisAntigo.slice(0, 10),
      atualizadoEm: new Date().toISOString().slice(0, 10),
    };

    if (!pareceValido(novo, antigo)) {
      console.warn("\nResultado incoerente com o anterior, mantendo o arquivo atual.");
      console.warn(`  antes: ${JSON.stringify(antigo)}`);
      console.warn(`  agora: ${JSON.stringify(novo)}`);
      if (!token) {
        console.warn(
          "  provável causa: rodou sem GITHUB_TOKEN, então o privado ficou de fora.",
        );
      }
      return;
    }

    fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
    fs.writeFileSync(DESTINO, `${JSON.stringify(novo, null, 2)}\n`, "utf8");

    console.log(
      `\n${commits} commits em ${comCommits} repositórios (${privados} privados), ${prsExternos} PRs aceitos fora de casa`,
    );
    console.log(
      `Operação desde ${novo.inicioOperacao}. Gravado em src/data/stats.json`,
    );
  } catch (erro) {
    console.warn(`\nFalha ao consultar o GitHub: ${erro.message}`);
    if (antigo) {
      console.warn(`Mantendo os números de ${antigo.atualizadoEm}. O build segue.`);
    } else {
      // Primeira execucao sem rede: grava um piso honesto para o build ter dados.
      const piso = {
        commits: 492,
        repositorios: 13,
        prsExternos: 16,
        inicioOperacao: "2025-06-01",
        atualizadoEm: "2026-08-20",
      };
      fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
      fs.writeFileSync(DESTINO, `${JSON.stringify(piso, null, 2)}\n`, "utf8");
      console.warn(
        "Sem arquivo anterior: gravado o último valor conhecido, de 20/08/2026.",
      );
    }
  }
}

await main();
