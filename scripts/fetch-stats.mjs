/**
 * Le a atividade publica no GitHub e grava src/data/stats.json.
 *
 * Roda no build e num workflow agendado toda segunda. Se a API falhar, ficar sem
 * rate limit ou devolver algo incoerente, o arquivo existente e mantido e o
 * script sai com codigo 0: numero desatualizado na pagina e ruim, build quebrado
 * as tres da manha por causa de um 502 da API e pior.
 *
 * O que NAO e buscado aqui:
 *   sistemasEmProducao  vem dos proprios arquivos de src/content/projects
 *   mesesDeOperacao     e calculado no componente, a partir de "inicioOperacao"
 *
 * Uso:
 *   node scripts/fetch-stats.mjs            (anonimo, 60 requisicoes por hora)
 *   GITHUB_TOKEN=ghp_... node scripts/...   (5000 por hora, usado no CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(ROOT, 'src/data/stats.json');

const USUARIO = 'CaTeIM';
const ORGS = ['self-labs'];
/**
 * Contas cujos repositorios sao meus: PR nelas nao conta como contribuicao externa.
 *
 * atlasdao entra aqui porque o Atlas Logistics e projeto proprio, so hospedado
 * numa organizacao separada. oroderico NAO entra: o Origo e projeto de outra
 * pessoa, onde eu corrijo bugs, entao PR la conta como contribuicao externa.
 */
const PROPRIAS = new Set([USUARIO.toLowerCase(), ...ORGS.map((o) => o.toLowerCase()), 'atlasdao']);

const API = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

async function api(caminho, { headersOnly = false } = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'selflabs-site-stats',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!resposta.ok) {
    const restante = resposta.headers.get('x-ratelimit-remaining');
    throw new Error(`GET ${caminho} devolveu ${resposta.status}${restante === '0' ? ' (rate limit esgotado)' : ''}`);
  }

  return headersOnly ? resposta.headers : resposta.json();
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

  const link = headers.get('link');
  if (link) {
    const ultima = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
    if (ultima) return Number.parseInt(ultima[1], 10);
  }

  // Sem header Link o repositorio tem zero ou um commit do autor.
  const commits = await api(`/repos/${nomeCompleto}/commits?author=${USUARIO}&per_page=1`);
  return Array.isArray(commits) ? commits.length : 0;
}

async function listarRepos() {
  const contas = [
    { caminho: `/users/${USUARIO}/repos`, dono: USUARIO },
    ...ORGS.map((org) => ({ caminho: `/orgs/${org}/repos`, dono: org })),
  ];

  const todos = [];
  for (const conta of contas) {
    try {
      const repos = await api(`${conta.caminho}?per_page=100&type=owner&sort=pushed`);
      todos.push(...repos.filter((r) => !r.private && !r.fork && !r.archived));
    } catch (erro) {
      // Organizacao privada sem permissao do token anonimo: segue com o resto.
      console.warn(`  aviso: ${conta.dono} indisponivel (${erro.message})`);
    }
  }
  return todos;
}

/** Pull requests do autor com merge, em repositorios que nao sao dele. */
async function contarPullRequestsExternos() {
  const excluir = [...PROPRIAS].map((c) => `-user:${c}`).join('+');
  const busca = await api(`/search/issues?q=type:pr+author:${USUARIO}+is:merged+${excluir}&per_page=1`);
  return Number.parseInt(busca.total_count ?? 0, 10);
}

function lerAtual() {
  try {
    return JSON.parse(fs.readFileSync(DESTINO, 'utf8'));
  } catch {
    return null;
  }
}

/** Recusa gravar um resultado obviamente degradado por cima de um bom. */
function pareceValido(novo, antigo) {
  if (novo.commits < 1 || novo.reposPublicos < 1) return false;
  if (!antigo) return true;
  // Uma queda maior que 20% quase sempre significa API parcial, nao apagamento.
  if (novo.commits < antigo.commits * 0.8) return false;
  if (novo.prsExternos < antigo.prsExternos * 0.8) return false;
  return true;
}

async function main() {
  const antigo = lerAtual();
  console.log(token ? 'Consultando a API do GitHub (autenticado)' : 'Consultando a API do GitHub (anonimo)');

  try {
    const repos = await listarRepos();
    if (repos.length === 0) throw new Error('nenhum repositorio publico retornado');

    let commits = 0;
    for (const repo of repos) {
      const n = await contarCommits(repo.full_name);
      commits += n;
      console.log(`  ${repo.full_name.padEnd(34)} ${String(n).padStart(4)} commits`);
    }

    const prsExternos = await contarPullRequestsExternos();

    const maisAntigo = repos.reduce(
      (menor, r) => (new Date(r.created_at) < new Date(menor) ? r.created_at : menor),
      repos[0].created_at,
    );

    const novo = {
      commits,
      reposPublicos: repos.length,
      prsExternos,
      /** Data do repositorio publico mais antigo: e daqui que sai "meses de operacao". */
      inicioOperacao: maisAntigo.slice(0, 10),
      atualizadoEm: new Date().toISOString().slice(0, 10),
    };

    if (!pareceValido(novo, antigo)) {
      console.warn('\nResultado incoerente com o anterior, mantendo o arquivo atual.');
      console.warn(`  antes: ${JSON.stringify(antigo)}`);
      console.warn(`  agora: ${JSON.stringify(novo)}`);
      return;
    }

    fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
    fs.writeFileSync(DESTINO, `${JSON.stringify(novo, null, 2)}\n`, 'utf8');

    console.log(`\n${commits} commits em ${repos.length} repositórios, ${prsExternos} PRs aceitos fora de casa`);
    console.log(`Operação desde ${novo.inicioOperacao}. Gravado em src/data/stats.json`);
  } catch (erro) {
    console.warn(`\nFalha ao consultar o GitHub: ${erro.message}`);
    if (antigo) {
      console.warn(`Mantendo os números de ${antigo.atualizadoEm}. O build segue.`);
    } else {
      // Primeira execucao sem rede: grava um piso honesto para o build ter dados.
      const piso = {
        commits: 492,
        reposPublicos: 13,
        prsExternos: 16,
        inicioOperacao: '2025-06-01',
        atualizadoEm: '2026-08-20',
      };
      fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
      fs.writeFileSync(DESTINO, `${JSON.stringify(piso, null, 2)}\n`, 'utf8');
      console.warn('Sem arquivo anterior: gravado o último valor conhecido, de 20/08/2026.');
    }
  }
}

await main();
