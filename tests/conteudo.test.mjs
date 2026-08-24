/**
 * Testes de conteudo. Rodam no runner nativo do Node, sem framework.
 *
 * Eles nao testam codigo, testam as regras editoriais que sao faceis de quebrar
 * sem perceber ao adicionar um projeto: um travessao que o editor inseriu
 * sozinho, um projeto sem par de traducao, dois designators iguais, ou uma
 * mencao a um assunto que foi retirado do escopo pelo dono.
 *
 * Rodar: npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJETOS_DIR = path.join(ROOT, 'src/content/projects');

const arquivos = fs.readdirSync(PROJETOS_DIR).filter((f) => f.endsWith('.json'));
const projetos = arquivos.map((f) => ({
  arquivo: f,
  bruto: fs.readFileSync(path.join(PROJETOS_DIR, f), 'utf8'),
  dados: JSON.parse(fs.readFileSync(path.join(PROJETOS_DIR, f), 'utf8')),
}));

/** Todo arquivo de texto do projeto, para as varreduras globais. */
function arquivosDeTexto() {
  const alvos = [];
  const varrer = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (['node_modules', 'dist', '.astro', '.git', '.wrangler'].includes(entrada.name)) continue;
        varrer(completo);
        continue;
      }
      if (/\.(astro|ts|tsx|mjs|js|json|css|md)$/.test(entrada.name)) {
        alvos.push({ caminho: path.relative(ROOT, completo), texto: fs.readFileSync(completo, 'utf8') });
      }
    }
  };
  varrer(path.join(ROOT, 'src'));
  varrer(path.join(ROOT, 'scripts'));
  return alvos;
}

describe('assuntos fora de escopo', () => {
  /**
   * O dono retirou um projeto do escopo e pediu que ele nao aparecesse em lugar
   * nenhum. Um teste segura isso melhor que memoria, inclusive contra um agente
   * que reintroduza o assunto num commit futuro.
   */
  const PROIBIDOS = [/brfarma/i, /farm[áa]cia/i, /drogaria/i, /medicamento/i];

  test('nenhum arquivo do projeto menciona assunto retirado do escopo', () => {
    const achados = [];
    for (const { caminho, texto } of arquivosDeTexto()) {
      if (caminho.replace(/\\/g, '/').includes('tests/')) continue; // este arquivo cita os termos
      for (const padrao of PROIBIDOS) {
        const m = texto.match(padrao);
        if (m) achados.push(`${caminho}: "${m[0]}"`);
      }
    }
    assert.deepEqual(achados, [], `assunto fora de escopo encontrado:\n${achados.join('\n')}`);
  });
});

describe('regras de escrita', () => {
  test('nenhum travessao nem meia risca em texto de conteudo', () => {
    const achados = [];
    for (const { arquivo, bruto } of projetos) {
      for (const sinal of ['—', '–']) {
        if (bruto.includes(sinal)) achados.push(`${arquivo}: ${sinal === '—' ? 'travessao' : 'meia risca'}`);
      }
    }
    assert.deepEqual(achados, [], `pontuacao proibida:\n${achados.join('\n')}`);
  });

  test('nenhum emoji nos textos de projeto', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const achados = projetos.filter((p) => emoji.test(p.bruto)).map((p) => p.arquivo);
    assert.deepEqual(achados, [], `emoji encontrado em: ${achados.join(', ')}`);
  });

  test('nenhum jargao de agencia', () => {
    const BANIDOS = /\b(solu[çc][õo]es inovadoras|transforma[çc][ãa]o digital|sinergia|ecossistema|de ponta|seamless|cutting.edge|game.changer)\b/i;
    const achados = projetos.filter((p) => BANIDOS.test(p.bruto)).map((p) => p.arquivo);
    assert.deepEqual(achados, [], `jargao encontrado em: ${achados.join(', ')}`);
  });
});

describe('integridade da vitrine', () => {
  test('exatamente seis projetos em destaque', () => {
    const destaques = projetos.filter((p) => p.dados.featured);
    assert.equal(
      destaques.length,
      6,
      `esperado 6, veio ${destaques.length}: ${destaques.map((d) => d.arquivo).join(', ')}`,
    );
  });

  test('a ordem vai de 1 a N sem repetir e sem buraco', () => {
    const ordens = projetos.map((p) => p.dados.order).sort((a, b) => a - b);
    const esperado = Array.from({ length: projetos.length }, (_, i) => i + 1);
    assert.deepEqual(ordens, esperado);
  });

  test('os seis destaques ocupam as seis primeiras posicoes', () => {
    const destaques = projetos.filter((p) => p.dados.featured).map((p) => p.dados.order);
    assert.deepEqual(destaques.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
  });

  test('nenhum designator repetido', () => {
    const vistos = new Map();
    for (const p of projetos) {
      const anterior = vistos.get(p.dados.designator);
      assert.equal(anterior, undefined, `${p.dados.designator} usado em ${anterior} e ${p.arquivo}`);
      vistos.set(p.dados.designator, p.arquivo);
    }
  });

  test('repositorio fechado nao expoe link de codigo', () => {
    const vazando = projetos.filter((p) => p.dados.closed && p.dados.repo).map((p) => p.arquivo);
    assert.deepEqual(vazando, [], `repositorio privado com link de codigo: ${vazando.join(', ')}`);
  });

  test('todo projeto tem os dois idiomas com pitch de verdade', () => {
    for (const { arquivo, dados } of projetos) {
      for (const idioma of ['pt', 'en']) {
        assert.ok(dados[idioma], `${arquivo}: falta o bloco "${idioma}"`);
        assert.ok(dados[idioma].name?.length >= 2, `${arquivo}: nome vazio em ${idioma}`);
        assert.ok(
          dados[idioma].pitch?.length >= 40,
          `${arquivo}: pitch curto demais em ${idioma} (${dados[idioma].pitch?.length ?? 0} caracteres)`,
        );
      }
    }
  });

  test('nota de campo existe nos dois idiomas ou em nenhum', () => {
    for (const { arquivo, dados } of projetos) {
      assert.equal(
        Boolean(dados.pt.note),
        Boolean(dados.en.note),
        `${arquivo}: nota de campo presente em um idioma so`,
      );
    }
  });

  test('todo destaque traz nota de campo', () => {
    const semNota = projetos.filter((p) => p.dados.featured && !p.dados.pt.note).map((p) => p.arquivo);
    assert.deepEqual(semNota, [], `destaque sem nota de campo: ${semNota.join(', ')}`);
  });

  test('a stack cabe entre dois e nove itens', () => {
    for (const { arquivo, dados } of projetos) {
      assert.ok(
        dados.stack.length >= 2 && dados.stack.length <= 9,
        `${arquivo}: ${dados.stack.length} itens na stack`,
      );
    }
  });

  test('todo link aponta para https', () => {
    for (const { arquivo, dados } of projetos) {
      for (const campo of ['link', 'repo']) {
        if (!dados[campo]) continue;
        assert.ok(dados[campo].startsWith('https://'), `${arquivo}: ${campo} nao e https`);
      }
    }
  });
});

describe('estatisticas derivadas', () => {
  const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/stats.json'), 'utf8'));

  test('o arquivo de estatisticas tem todos os campos que a pagina le', () => {
    for (const campo of ['commits', 'repositorios', 'prsExternos', 'inicioOperacao', 'atualizadoEm']) {
      assert.ok(campo in stats, `falta o campo "${campo}" em stats.json`);
    }
  });

  test('as datas estao no formato ano-mes-dia', () => {
    assert.match(stats.inicioOperacao, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(stats.atualizadoEm, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('os numeros sao positivos', () => {
    assert.ok(stats.commits > 0);
    assert.ok(stats.repositorios > 0);
    assert.ok(stats.prsExternos >= 0);
  });
});

describe('regras de folha de estilo que ja quebraram', () => {
  /*
   * Os comentarios sao removidos antes de qualquer checagem. Sem isso o teste le
   * a propria explicacao de um bug como se fosse a declaracao que o causa: o
   * comentario do body cita "overflow-x: hidden" exatamente para dizer que nao
   * se deve usar, e o teste acusava a frase que existe para preveni-lo.
   */
  const css = fs
    .readFileSync(path.join(ROOT, 'src/styles/app.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /*
   * O filtro do portfolio marcava quinze cards com o atributo hidden e nao
   * escondia nenhum, porque ".card { display: flex }" vence o display do
   * navegador para [hidden]: folha de autor sempre ganha da folha do navegador.
   * A regra global com !important e o conserto, e este teste impede que alguem
   * a remova por parecer supérflua.
   */
  test('o atributo hidden vence qualquer display declarado', () => {
    const regra = css.match(/\[hidden\]\s*\{[^}]*\}/);
    assert.ok(regra, 'falta a regra global para [hidden] em app.css');
    assert.match(regra[0], /display:\s*none\s*!important/, 'a regra [hidden] precisa de display none com !important');
  });

  /*
   * "overflow-x: hidden" no body transforma o body em contexto de rolagem, e
   * isso desliga o scroll suave declarado no html. Ja aconteceu uma vez.
   */
  test('o body usa overflow-x clip, nunca hidden', () => {
    const corpo = css.match(/\nbody\s*\{[^}]*\}/);
    assert.ok(corpo, 'bloco do body nao encontrado');
    assert.doesNotMatch(corpo[0], /overflow-x:\s*hidden/, 'overflow-x hidden no body quebra o scroll suave');
  });

  /*
   * A rolagem de ancora e movimento de orientacao, nao decoracao. Forcar
   * scroll-behavior auto sob reduced motion entregava salto seco justamente a
   * quem tinha a preferencia ligada, e o proprio Safari anima nesse caso.
   */
  test('reduced motion nao forca scroll-behavior auto', () => {
    const bloco = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/);
    assert.ok(bloco, 'bloco de prefers-reduced-motion nao encontrado');
    assert.doesNotMatch(bloco[0], /scroll-behavior:\s*auto/, 'deixe o navegador decidir o scroll sob reduced motion');
  });
});

describe('versao CalVer', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  test('a versao segue ANO.MES.REVISAO', () => {
    assert.match(pkg.version, /^\d{4}\.\d{1,2}\.\d+$/, `versao fora do padrao CalVer: ${pkg.version}`);
  });

  test('o mes nao tem zero a esquerda', () => {
    const mes = pkg.version.split('.')[1];
    assert.ok(!(mes.length > 1 && mes.startsWith('0')), `mes com zero a esquerda: ${pkg.version}`);
  });

  test('o mes esta entre 1 e 12', () => {
    const mes = Number(pkg.version.split('.')[1]);
    assert.ok(mes >= 1 && mes <= 12, `mes invalido: ${pkg.version}`);
  });

  test('a revisao e um inteiro positivo', () => {
    const rev = Number(pkg.version.split('.')[2]);
    assert.ok(Number.isInteger(rev) && rev >= 1, `revisao invalida: ${pkg.version}`);
  });
});
