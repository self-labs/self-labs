/**
 * Invariantes da Content-Security-Policy gerada em scripts/build-headers.mjs.
 *
 * Uma CSP tem uma propriedade desagradavel: quando ela esta errada, quem
 * descobre e o visitante, no navegador dele, e o erro fica no console dele. Do
 * lado de ca o build passa, o deploy passa, o site "esta no ar" e a home
 * simplesmente nao anima, ou perde a fonte, ou perde o menu.
 *
 * Os dois defeitos abaixo aconteceram de verdade ao escrever esta politica, e
 * so apareceram porque ela foi servida por http e carregada por um Chrome de
 * verdade antes de ser publicada:
 *
 *   1. Os comentarios do projeto citam a tag <style> dentro da prosa. A busca
 *      pelos blocos comecava dentro de um comentario e terminava no </style>
 *      real, produzindo um hash de um texto que mistura comentario com CSS. O
 *      bloco de @keyframes ficava sem hash e a animacao morria.
 *   2. "font-src 'self'" recusava duas familias, porque o Astro embute parte
 *      das woff2 como data URI dentro do CSS. A pagina caia para a fonte de
 *      sistema sem nenhum sinal do lado de ca.
 *
 * Nenhum dos dois seria pego por leitura. Por isso estas invariantes existem.
 *
 * Rodar: npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { blocosEmbutidos, hashCsp, montarCsp } from '../scripts/build-headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('extracao dos blocos embutidos', () => {
  test('um comentario que cita <style> nao engole o bloco seguinte', () => {
    const html = `
      <!-- O <style> do Astro e estatico e nao aceita interpolacao. -->
      <style>@keyframes onda { from { opacity: 0 } }</style>
    `;

    const blocos = blocosEmbutidos(html, 'style');

    assert.equal(blocos.length, 1);
    assert.equal(blocos[0], '@keyframes onda { from { opacity: 0 } }');
    assert.ok(
      !blocos[0].includes('Astro'),
      'o bloco nao pode carregar texto de comentario junto',
    );
  });

  test('script com src fica de fora: ele e coberto por self, nao por hash', () => {
    const html = `
      <script src="/_assets/app.js"></script>
      <script>console.log("embutido")</script>
    `;

    const blocos = blocosEmbutidos(html, 'script');

    assert.equal(blocos.length, 1);
    assert.equal(blocos[0], 'console.log("embutido")');
  });

  test('o hash e do conteudo exato, byte a byte', () => {
    const conteudo = 'body{color:#e8f0f2}';
    const esperado = crypto.createHash('sha256').update(conteudo, 'utf8').digest('base64');

    assert.equal(hashCsp(conteudo), `'sha256-${esperado}'`);
  });
});

describe('a politica montada', () => {
  const csp = montarCsp(["'sha256-aaa'"], ["'sha256-bbb'"]);
  const diretivas = Object.fromEntries(
    csp.split('; ').map((d) => {
      const [nome, ...resto] = d.split(' ');
      return [nome, resto.join(' ')];
    }),
  );

  test('nada e permitido por omissao', () => {
    assert.equal(diretivas['default-src'], "'none'");
  });

  test('script nunca aceita unsafe-inline nem unsafe-eval', () => {
    assert.ok(!csp.includes("script-src 'unsafe-inline'"));
    assert.ok(!diretivas['script-src'].includes("'unsafe-inline'"));
    assert.ok(!diretivas['script-src'].includes("'unsafe-eval'"));
    assert.ok(diretivas['script-src'].includes("'sha256-aaa'"));
  });

  test('estilo separa elemento de atributo', () => {
    // Com um style-src generico no lugar, o Chrome recusou os atributos
    // style="" citando style-src, e nao style-src-attr. Medido.
    assert.ok(diretivas['style-src-elem'].includes("'sha256-bbb'"));
    assert.equal(diretivas['style-src-attr'], "'unsafe-inline'");
    assert.equal(diretivas['style-src'], undefined, 'o generico nao pode voltar');
  });

  test('font aceita data:, senao duas familias nao carregam', () => {
    assert.ok(diretivas['font-src'].includes('data:'));
  });

  test('as travas de contexto estao todas presentes', () => {
    assert.equal(diretivas['base-uri'], "'none'");
    assert.equal(diretivas['form-action'], "'none'");
    assert.equal(diretivas['frame-ancestors'], "'none'");
    assert.equal(diretivas['object-src'], "'none'");
    assert.ok(csp.includes('upgrade-insecure-requests'));
  });

  test('nenhuma origem externa entra na politica', () => {
    assert.ok(
      !/https?:\/\//.test(csp),
      'a pagina nao carrega nada de terceiro: nenhuma URL deve aparecer aqui',
    );
  });
});

describe('o arquivo publicado, quando ha um dist', () => {
  const arquivo = path.join(ROOT, 'dist/_headers');
  const existe = fs.existsSync(arquivo);

  test('todo bloco embutido do dist tem hash na politica', { skip: !existe }, () => {
    const headers = fs.readFileSync(arquivo, 'utf8');
    const csp = headers.match(/Content-Security-Policy: (.+)/)?.[1] ?? '';

    const paginas = fs
      .readdirSync(path.join(ROOT, 'dist'), { recursive: true })
      .filter((nome) => String(nome).endsWith('.html'));

    assert.ok(paginas.length > 0, 'nenhuma pagina em dist/');

    for (const pagina of paginas) {
      const html = fs.readFileSync(path.join(ROOT, 'dist', String(pagina)), 'utf8');
      for (const tag of ['script', 'style']) {
        for (const bloco of blocosEmbutidos(html, tag)) {
          assert.ok(
            csp.includes(hashCsp(bloco)),
            `${pagina}: um bloco <${tag}> nao tem hash na CSP. Rode o build de novo.`,
          );
        }
      }
    }
  });

  test('o security.txt acompanha o build', { skip: !existe }, () => {
    const alvo = path.join(ROOT, 'dist/.well-known/security.txt');
    assert.ok(fs.existsSync(alvo), 'dist/.well-known/security.txt nao foi copiado');

    const conteudo = fs.readFileSync(alvo, 'utf8');
    assert.match(conteudo, /^Contact: mailto:/m);
    assert.match(conteudo, /^Expires: \d{4}-\d{2}-\d{2}T/m);

    // RFC 9116: um security.txt vencido e pior que nenhum, porque anuncia um
    // canal que ninguem promete mais ler.
    const expira = new Date(conteudo.match(/^Expires: (.+)$/m)[1]);
    assert.ok(expira > new Date(), 'o campo Expires do security.txt ja passou');
  });
});
