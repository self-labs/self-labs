/**
 * Invariantes da animacao do ECG.
 *
 * Estes testes existem porque o defeito mais teimoso deste projeto voltou quatro
 * vezes com roupas diferentes, e todas as vezes chegou ao dono como a mesma
 * frase: "o ponto some antes de chegar ao fim".
 *
 * As quatro causas, medidas:
 *   1. A fita corria em 9s e o cabecote em 18s. Uma vez por volta o ponto
 *      saltava 165.6px, exatamente um ciclo, no meio da area opaca.
 *   2. A partida ficava em 190px, que nao e multiplo das 120 unidades do ciclo,
 *      entao o ponto corria 70 unidades ao lado da onda em vez de sobre ela.
 *   3. O percurso era escolhido por media query em dois degraus, e a largura da
 *      janela e continua. Num monitor de 1920 o ponto terminava a 79% da faixa,
 *      em area 100% opaca, e reaparecia na esquerda do nada.
 *   4. A mascara apagava num ponto fixo da faixa enquanto o percurso mudava com
 *      a largura. O ponto chegava a 91.7% mas comecava a sumir aos 78%, e o
 *      traco seguia visivel depois dele: existia um fim da linha que o cabecote
 *      nunca alcancava.
 *
 * O conserto de cada uma foi estrutural, nunca um numero ajustado no olho:
 *   - os dois eixos viraram grupos aninhados, um repete a onda e o outro e uma
 *     reta, entao a fase nao tem como escorregar;
 *   - a duracao do avanco e escrita como multiplo da batida, nunca como numero
 *     solto;
 *   - a mascara termina no --fim, o mesmo valor que define o percurso, entao o
 *     traco acaba junto com o ponto e nao sobra linha depois dele.
 *
 * A licao virou regra: invariante que so vive em comentario nao se sustenta.
 *
 * Rodar: npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hero = fs.readFileSync(path.join(ROOT, 'src/components/Hero.astro'), 'utf8');

/** Um ciclo do traco, em unidades do viewBox. */
const CICLO = 120;

/**
 * A escala do desenho na tela.
 *
 * Com preserveAspectRatio "slice" ela e o MAIOR entre largura e altura. A faixa
 * tem 3.5rem de altura sobre as 40 unidades do viewBox, e a largura util nunca
 * passa de 1080px, o que daria 0.75. A altura manda sempre.
 *
 * O 1px descontado nao e detalhe: a faixa carrega border-block-start e o box
 * sizing do projeto e border-box, entao a area de conteudo tem 55px e nao 56. A
 * escala real, medida no navegador pelo getScreenCTM, e 1.375 e nao 1.4. Com o
 * numero errado esta suite aprovava cortes que na tela terminavam mais cedo do
 * que a conta prometia.
 */
const ALTURA_BORDA = 1;
const ESCALA = (56 - ALTURA_BORDA) / 40;

/** Quantos pixels de tela um ciclo ocupa. */
const PX_POR_CICLO = CICLO * ESCALA;

/**
 * A largura util da faixa, em pixels CSS, para uma janela de N pixels.
 *
 * A faixa vive dentro da casca: para no --largura de 74rem e desconta o recuo
 * lateral, que muda em 60rem de 2x --s5 para --gutter mais --s6.
 */
function larguraUtil(janela) {
  const contida = Math.min(janela, 74 * 16);
  const recuo = janela >= 60 * 16 ? 4.5 * 16 + 2 * 16 : 2 * 1.5 * 16;
  return contida - recuo;
}

/** Le os pares (breakpoint em px, ciclos) declarados no CSS do componente. */
function faixasDeciclos() {
  const base = hero.match(/\.ecg\s*\{[\s\S]*?--ciclos:\s*(\d+);/);
  assert.ok(base, 'nao encontrei o --ciclos base em .ecg');

  const faixas = [{ desde: 320, ciclos: Number(base[1]) }];
  for (const m of hero.matchAll(
    /@media \(min-width: ([\d.]+)rem\)\s*\{\s*\.ecg\s*\{\s*--ciclos:\s*(\d+);/g,
  )) {
    faixas.push({ desde: Number.parseFloat(m[1]) * 16, ciclos: Number(m[2]) });
  }
  faixas.sort((a, b) => a.desde - b.desde);
  return faixas;
}

describe('ECG, o fim do percurso', () => {
  /*
   * O teste que impede a queixa de voltar.
   *
   * Nao mede se o ponto chega longe o bastante: mede que NAO EXISTE traco depois
   * dele. Enquanto a mascara apagar exatamente onde o cabecote morre, a pergunta
   * "sumiu antes do fim?" deixa de fazer sentido, porque aquele e o fim.
   */
  test('a mascara acaba exatamente onde o cabecote acaba', () => {
    const mascara = hero.match(/mask-image:\s*linear-gradient\(([\s\S]*?)\);/);
    assert.ok(mascara, 'nao encontrei a mascara da faixa');
    assert.match(
      mascara[1],
      /transparent\s+var\(--fim\)/,
      'a mascara precisa terminar em var(--fim), senao sobra traco depois do ponto',
    );
    assert.doesNotMatch(
      mascara[1],
      /#000\s+\d+%/,
      'porcentagem fixa na mascara: ela deixa de acompanhar o percurso e o ponto volta a sumir cedo',
    );
  });

  test('o --fim deriva da geometria, nunca de um numero cravado', () => {
    /*
     * Cravar pixels aqui parece inofensivo e nao e. Medido no Chrome com o
     * Windows em 125%, a borda de 1px computa 0.8px, a area de conteudo vai de
     * 55px para 55.2 e a escala de 1.375 para 1.380. Um --fim escrito como
     * "165px por ciclo" erra 3.6px numa faixa de 1080 e erra mais a cada passo
     * de zoom, o que descola a mascara do percurso justamente no fim.
     *
     * A forma correta e relativa: um ciclo tem 120 unidades de viewBox sobre as
     * 40 que a faixa mostra, ou seja tres vezes a area de conteudo.
     */
    const fim = hero.match(/--fim:\s*calc\(([^;]+)\);/);
    assert.ok(fim, 'nao encontrei a definicao de --fim');

    assert.doesNotMatch(
      fim[1],
      /\d+px/,
      'o --fim voltou a carregar pixels cravados e vai errar sob zoom',
    );
    assert.match(
      fim[1],
      /var\(--ciclos\)\s*\*\s*3\s*\*\s*\(var\(--altura\)\s*-\s*var\(--borda\)\)/,
      'o --fim precisa ser ciclos x 3 x (altura - borda), que e 120 unidades sobre 40',
    );
  });

  test('a proporcao entre o ciclo e a altura da faixa continua sendo tres', () => {
    /*
     * Se o viewBox mudar de 1440x40, o fator 3 do --fim deixa de valer.
     *
     * Precisa ancorar na classe: o Hero tem outro svg antes deste, a seta de
     * 16x16 dentro do botao, e um regex solto por viewBox pega aquele.
     */
    const viewBox = hero.match(/class="ecg-svg" viewBox="0 0 (\d+) (\d+)"/);
    assert.ok(viewBox, 'nao encontrei o viewBox da faixa');
    assert.equal(
      CICLO / Number(viewBox[2]),
      3,
      `o ciclo tem ${CICLO} unidades sobre ${viewBox[2]} de altura: o fator do --fim nao e mais 3`,
    );
  });

  test('o desvanecimento cabe dentro do percurso mais curto', () => {
    /*
     * O trecho que apaga e escrito em rem. Se ele ficar mais longo que o proprio
     * percurso, o ponto nasce ja dentro do apagamento e a faixa inteira fica
     * fantasma na largura mais estreita.
     */
    const recuo = hero.match(/--fade:\s*([\d.]+)rem/);
    assert.ok(recuo, 'nao encontrei o --fade');

    // As duas pontas precisam usar o mesmo valor, senao o ponto nasce num ritmo
    // e morre em outro, que foi a queixa "inicia bem, finaliza mal".
    const usos = hero.match(/var\(--fade\)/g) ?? [];
    assert.equal(usos.length, 2, `o --fade e usado ${usos.length} vez(es), precisa ser 2`);

    const menorPercurso = Math.min(...faixasDeciclos().map((f) => f.ciclos)) * PX_POR_CICLO;
    const apagamento = Number.parseFloat(recuo[1]) * 16;
    assert.ok(
      apagamento < menorPercurso / 2,
      `o apagamento tem ${apagamento}px e o percurso mais curto tem ${menorPercurso}px`,
    );
  });
});

describe('ECG, cobertura da faixa', () => {
  /*
   * Com a mascara acompanhando o percurso, a razao deixa de ser questao de vida
   * ou morte e vira questao de proporcao: percurso curto demais deixa a faixa
   * meio vazia, longo demais mantem o ponto fora do quadro tempo demais.
   */
  const MINIMO = 0.75;
  const MAXIMO = 1.3;

  const faixas = faixasDeciclos();

  test('toda faixa de largura tem percurso declarado', () => {
    assert.ok(faixas.length >= 2, `so encontrei ${faixas.length} faixa(s) de --ciclos`);
  });

  test('o percurso guarda proporcao com a faixa em qualquer largura', () => {
    const falhas = [];

    for (let i = 0; i < faixas.length; i++) {
      const { desde, ciclos } = faixas[i];
      const ate = i + 1 < faixas.length ? faixas[i + 1].desde - 1 : 2560;
      const percurso = ciclos * PX_POR_CICLO;

      /*
       * Basta medir os extremos: dentro de uma faixa o percurso e constante e a
       * largura util cresce de forma monotona. A excecao e o degrau de 60rem,
       * onde o recuo lateral aumenta e a largura util CAI, e por isso ele e um
       * breakpoint proprio.
       */
      for (const janela of [desde, ate]) {
        const util = larguraUtil(janela);
        const razao = percurso / util;
        if (razao < MINIMO || razao > MAXIMO) {
          falhas.push(
            `janela ${janela}px: ${ciclos} ciclos dao ${percurso.toFixed(0)}px de percurso ` +
              `para ${util.toFixed(0)}px de faixa (razao ${razao.toFixed(2)}, ` +
              `aceito ${MINIMO} a ${MAXIMO})`,
          );
        }
      }
    }

    assert.deepEqual(falhas, [], `o percurso saiu de proporcao:\n${falhas.join('\n')}`);
  });

  test('a escala do desenho e a que a matematica dos cortes assume', () => {
    // Se a altura da faixa mudar sem recalcular os cortes, todos eles saem errados.
    const altura = hero.match(/\.ecg\s*\{[\s\S]*?--altura:\s*([\d.]+)rem/);
    assert.ok(altura, 'nao encontrei a --altura da faixa');

    // A borda superior come da altura, porque o projeto inteiro usa border-box.
    const temBorda = /\.ecg\s*\{[\s\S]*?border-block-start:\s*var\(--borda\)/.test(hero);
    const conteudo = Number.parseFloat(altura[1]) * 16 - (temBorda ? ALTURA_BORDA : 0);

    assert.equal(
      conteudo / 40,
      ESCALA,
      `a area de conteudo da faixa tem ${conteudo}px: recalcule --fim e os breakpoints de --ciclos`,
    );
  });

  test('a largura util nunca faz a largura mandar na escala', () => {
    // Se a faixa deixar de ser contida pela casca, a escala passa a variar e
    // toda a conta de cobertura deixa de valer.
    const maior = larguraUtil(2560);
    assert.ok(
      maior / 1440 < ESCALA,
      `a faixa chegou a ${maior}px e a largura passou a mandar na escala`,
    );
  });
});

describe('ECG, cadencia', () => {
  test('cada --ciclos anda junto com o seu keyframe', () => {
    /*
     * Trocar o numero e esquecer o nome, ou o contrario, tira o ponto de cima da
     * onda e descola a mascara do percurso, sem nenhum sinal em tempo de build.
     */
    const ciclosPorFaixa = faixasDeciclos().map((f) => f.ciclos);

    const nomes = [];
    const base = hero.match(/animation:\s*avanco-(\d+)\s+calc/);
    assert.ok(base, 'nao encontrei a animacao base do avanco');
    nomes.push(Number(base[1]));
    for (const m of hero.matchAll(/animation-name:\s*avanco-(\d+);/g)) nomes.push(Number(m[1]));

    assert.deepEqual(
      nomes,
      ciclosPorFaixa,
      `os keyframes (${nomes.join(', ')}) nao acompanham os --ciclos (${ciclosPorFaixa.join(', ')})`,
    );
  });

  test('o rastro corre exatamente com o cabecote', () => {
    /*
     * Se o rastro ganhar animacao propria, o brilho descola do ponto e a faixa
     * passa a acender num lugar onde o cabecote nao esta.
     */
    /*
     * Toda regra que abre com .ecg-rastro precisa trazer .ecg-avanco na mesma
     * lista de seletores. Procurar so por ".ecg-rastro {" seguido de "animation"
     * nao serve: casa tambem com o caso correto, porque no seletor duplo o
     * .ecg-rastro e justamente o ultimo antes da chave.
     */
    const regras = [...hero.matchAll(/([^\n]*)\n\s*\.ecg-rastro\s*\{/g)];
    assert.ok(regras.length >= 1, 'o rastro nao aparece como seletor em lugar nenhum');

    const sozinhas = regras
      .filter(([, anterior]) => !anterior.includes('.ecg-avanco,'))
      .map(([, anterior]) => anterior.trim() || '(inicio de bloco)');

    assert.deepEqual(
      sozinhas,
      [],
      `o rastro ganhou regra propria e vai descolar do ponto, apos: ${sozinhas.join(' | ')}`,
    );
  });

  test('todo --ciclos usado no CSS tem keyframe gerado', () => {
    /*
     * Os keyframes nascem no build a partir da lista CICLOS, entao procurar
     * "@keyframes avanco-4" como texto neste arquivo nunca acharia nada.
     */
    const lista = hero.match(/const CICLOS = \[([\d,\s]+)\]/);
    assert.ok(lista, 'nao encontrei a lista CICLOS');
    const gerados = new Set(lista[1].split(',').map((n) => Number(n.trim())));

    const faltando = faixasDeciclos()
      .map((f) => f.ciclos)
      .filter((n) => !gerados.has(n));

    assert.deepEqual(
      [...new Set(faltando)],
      [],
      `o CSS pede ciclos que CICLOS nao gera: ${[...new Set(faltando)].join(', ')}`,
    );
  });

  test('o gerador de avanco termina no fim do ultimo ciclo', () => {
    // Se o ponto final deixar de ser n vezes o ciclo, o cabecote passa a parar
    // no meio de uma onda e o salto de volta ao inicio fica visivel.
    assert.match(
      hero,
      /to \{ translate: \$\{n \* 120\}px; \}/,
      'o keyframe de avanco precisa terminar em n * 120px',
    );
  });

  test('o avanco dura um multiplo inteiro da onda', () => {
    /*
     * Esta e a garantia de fase, e ela e estrutural: a duracao do avanco tem que
     * ser escrita como o numero de ciclos vezes a batida, e nunca como um numero
     * solto. Com dois numeros independentes o ponto volta a sair de cima da onda.
     */
    assert.match(
      hero,
      /animation:\s*avanco-\d+\s+calc\(var\(--ciclos[^)]*\)\s*\*\s*var\(--batida[^)]*\)\)/,
      'a duracao do avanco precisa ser ciclos vezes batida',
    );
    assert.match(
      hero,
      /\.ecg-cabecote\s*\{[\s\S]{0,400}?animation:\s*onda\s+var\(--batida[^)]*\)/,
      'a onda precisa durar exatamente uma batida',
    );

    /*
     * Toda var dentro da shorthand precisa de valor de reserva. Sem ele, um var
     * que nao chegue ao elemento invalida a declaracao INTEIRA, e o efeito nao e
     * uma duracao errada: e a animacao deixar de existir, sem aviso nenhum.
     */
    const semReserva = [...hero.matchAll(/animation:\s*(?:avanco-\d+|onda)[^;]*/g)].flatMap((m) =>
      [...m[0].matchAll(/var\(--(?:ciclos|batida)\s*\)/g)].map((v) => v[0]),
    );
    assert.deepEqual(
      semReserva,
      [],
      `var sem valor de reserva na animacao: ${semReserva.join(', ')}`,
    );
  });

  test('a batida cai numa frequencia cardiaca plausivel', () => {
    const batida = hero.match(/--batida:\s*([\d.]+)s/);
    assert.ok(batida, 'nao encontrei a --batida');
    const bpm = 60 / Number.parseFloat(batida[1]);
    assert.ok(bpm >= 40 && bpm <= 100, `${bpm.toFixed(0)} batimentos por minuto nao e repouso`);
  });

  /*
   * Se a respiracao do halo for divisor inteiro da batida, ela cai sempre nos
   * mesmos pontos do traco e vira um pulso repetitivo em lugares fixos. Foi
   * exatamente essa a queixa: "um pulso longo e grande do nada em dois pontos
   * exatos da linha".
   */
  test('a respiracao do halo nao cai sempre no mesmo ponto do traco', () => {
    const batida = Number.parseFloat(hero.match(/--batida:\s*([\d.]+)s/)[1]);
    const halo = Number.parseFloat(hero.match(/animation:\s*respirar\s+([\d.]+)s/)[1]);

    const razao = halo / batida;
    assert.ok(
      Math.abs(razao - Math.round(razao)) > 0.05,
      `halo ${halo}s dividido por batida ${batida}s da ${razao.toFixed(3)}, redondo demais: a respiracao vai sincronizar com a onda`,
    );
  });

  test('o halo respira em brilho, nunca em tamanho', () => {
    const quadros = hero.match(/@keyframes respirar\s*\{[\s\S]*?\n {2}\}/);
    assert.ok(quadros, 'keyframes da respiracao nao encontrados');
    assert.doesNotMatch(
      quadros[0],
      /transform|scale/,
      'a respiracao voltou a mudar de tamanho, o que produz o pulso seco que foi removido',
    );
    assert.match(quadros[0], /opacity/, 'a respiracao precisa variar a opacidade');
  });

  test('movimento reduzido para o ECG em vez de tentar desacelerar', () => {
    /*
     * Desacelerar nao funciona e ainda engana quem le o codigo. Medido no Chrome
     * sobre Windows com "Efeitos de animacao" desligado: o navegador forca
     * animation-duration para 1e-06s em TODA animacao CSS, entao qualquer
     * duracao declarada aqui e descartada antes de valer. O que sobrava na tela
     * era um ECG travado no primeiro quadro, com o cabecote em x=0, dentro da
     * borda que a mascara apaga, e isso le como defeito, nao como decisao.
     */
    const bloco = hero.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n {2}\}/);
    assert.ok(bloco, 'bloco de movimento reduzido nao encontrado no Hero');

    assert.doesNotMatch(
      bloco[0],
      /--batida:/,
      'redefinir a --batida aqui nao tem efeito: o navegador ja zera a duracao',
    );

    for (const alvo of ['ecg-avanco', 'ecg-cabecote']) {
      assert.match(
        bloco[0],
        new RegExp(`\\.${alvo}[\\s\\S]{0,240}?animation:\\s*none`),
        `.${alvo} precisa parar explicitamente sob movimento reduzido`,
      );
    }
  });

  test('parado, o cabecote descansa sobre a linha de base e longe das bordas', () => {
    /*
     * A onda so volta a linha de base a cada ciclo inteiro. Parar num
     * deslocamento qualquer deixaria o ponto flutuando ao lado do traco, e parar
     * em zero o esconderia dentro do apagamento da borda esquerda.
     */
    const bloco = hero.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n {2}\}/);
    const parada = bloco[0].match(
      /translate:\s*calc\(var\(--fim\)\s*\/\s*var\(--ciclos\)(?:\s*\*\s*(\d+))?\)/,
    );
    assert.ok(parada, 'a parada precisa ser um numero inteiro de ciclos a partir da partida');

    // Sem multiplicador escrito, a parada e de um ciclo.
    const ciclosAdiante = parada[1] ? Number(parada[1]) : 1;
    assert.ok(ciclosAdiante >= 1, 'parar em zero esconde o ponto na borda que apaga');

    const menor = Math.min(...faixasDeciclos().map((f) => f.ciclos));
    assert.ok(
      ciclosAdiante < menor,
      `para em ${ciclosAdiante} ciclos, mas a faixa mais estreita percorre so ${menor}`,
    );

    // E o Y precisa ser a linha de base, que e onde a onda esta em ciclo inteiro.
    assert.match(
      bloco[0],
      /\.ecg-cabecote\s*\{[\s\S]{0,120}?translate:\s*0\s+20px/,
      'o cabecote parado precisa ficar em y=20, a linha de base do viewBox',
    );
  });
});

describe('ECG, geometria', () => {
  test('o ciclo comeca e termina na mesma altura', () => {
    // Sem isso a emenda entre um ciclo e o seguinte aparece como degrau na fita.
    const ciclo = hero.match(/const CICLO = '([^']+)'/);
    assert.ok(ciclo, 'nao encontrei a definicao do ciclo');

    /*
     * Precisa percorrer os comandos de verdade, e nao casar pares de numeros:
     * "h" carrega um valor so, "l" carrega x e y, e "q" carrega quatro, dos
     * quais apenas o ultimo e o deslocamento vertical do ponto final. Uma versao
     * anterior deste teste somava tudo aos pares e acusava um ciclo correto.
     */
    const tokens = ciclo[1].match(/[a-zA-Z]|-?[\d.]+/g) ?? [];
    let i = 0;
    let comando = '';
    let vertical = 0;

    while (i < tokens.length) {
      if (/[a-zA-Z]/.test(tokens[i])) comando = tokens[i++];

      if (comando === 'h') {
        i += 1;
      } else if (comando === 'l') {
        i += 1; // dx
        vertical += Number.parseFloat(tokens[i++]);
      } else if (comando === 'q') {
        i += 3; // dx e dy do controle, mais dx do ponto final
        vertical += Number.parseFloat(tokens[i++]);
      } else {
        i += 1;
      }
    }

    assert.ok(
      Math.abs(vertical) < 0.001,
      `os deslocamentos verticais do ciclo somam ${vertical}, e precisam somar zero para a fita emendar sem degrau`,
    );
  });

  test('o traco desenhado cobre tudo que o cabecote percorre', () => {
    /*
     * O traco tem comprimento fixo. Se o cabecote correr mais do que ele, o
     * ponto sai andando no vazio no fim do percurso.
     */
    const repeticoes = hero.match(/CICLO\.repeat\((\d+)\)/);
    assert.ok(repeticoes, 'nao encontrei quantos ciclos a fita repete');

    const traco = Number(repeticoes[1]) * CICLO;
    const maiorPercurso = Math.max(...faixasDeciclos().map((f) => f.ciclos)) * CICLO;
    assert.ok(
      traco >= maiorPercurso,
      `a fita tem ${traco} unidades e o cabecote percorre ${maiorPercurso}`,
    );

    // E precisa cobrir tambem o que a tela mostra na janela mais larga.
    const visivel = larguraUtil(2560) / ESCALA;
    assert.ok(traco >= visivel, `a fita tem ${traco} unidades e a tela mostra ${visivel.toFixed(0)}`);
  });

  test('o rastro cobre pelo menos um batimento inteiro', () => {
    // Mais curto que um ciclo, o brilho corta o QRS ao meio e pisca.
    const rastro = hero.match(/const RASTRO = (\d+)/);
    assert.ok(rastro, 'nao encontrei o comprimento do rastro');
    assert.ok(
      Number(rastro[1]) >= CICLO,
      `o rastro tem ${rastro[1]} unidades e um ciclo tem ${CICLO}`,
    );
  });
});

describe('ECG, o resgate por JavaScript sob movimento reduzido', () => {
  /*
   * O Chromium zera a duracao de toda animacao declarada em CSS enquanto a
   * preferencia esta ligada (medido: animation-duration computa 1e-06s), e a
   * Web Animations API nao sofre esse corte. O script existe so por isso.
   *
   * O CSS continua parando a faixa num ponto digno, e essa parada e o que
   * aparece quando nao ha JavaScript. Uma coisa nao substitui a outra.
   */
  test('o script anima pela API, nao por classe que ligue o CSS de volta', () => {
    assert.match(hero, /\.animate\(/, 'o resgate precisa usar a Web Animations API');
    assert.match(
      hero,
      /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/,
      'o script precisa consultar a preferencia',
    );
  });

  test('o script reaproveita os quadros do CSS em vez de reescreve-los', () => {
    /*
     * A forma da onda e calculada no build a partir da geometria do traco.
     * Reescreve-la no script criaria um segundo lugar para ela divergir, e a
     * divergencia so apareceria para quem tem a preferencia ligada, que e quem
     * menos costuma ser testado.
     */
    assert.match(hero, /CSSKeyframesRule/, 'os quadros precisam sair da folha de estilo');
    assert.match(
      hero,
      /lerQuadros\(`avanco-\$\{ciclos\}`\)/,
      'o percurso precisa vir do keyframe correspondente ao --ciclos vigente',
    );
  });

  test('o ritmo reduzido e mais lento, e nunca parado', () => {
    const fator = hero.match(/const LENTO = (\d+)/);
    assert.ok(fator, 'nao encontrei o fator de desaceleracao');
    const n = Number(fator[1]);
    assert.ok(n > 1, 'o fator precisa desacelerar');
    assert.ok(n <= 4, `fator ${n} deixa a volta longa demais para parecer viva`);
  });

  test('o CSS mantem a parada como reserva para quem nao tem JavaScript', () => {
    const bloco = hero.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n {2}\}/);
    assert.ok(bloco, 'bloco de movimento reduzido sumiu');
    assert.match(
      bloco[0],
      /animation:\s*none/,
      'sem JavaScript a faixa precisa ficar parada de proposito, e nao no primeiro quadro',
    );
  });

  test('mudar de largura remonta a animacao', () => {
    // O --ciclos muda com a media query, e com ele o percurso. Sem remontar, o
    // cabecote passaria a correr uma distancia que nao corresponde mais a faixa.
    assert.match(hero, /addEventListener\(\s*'resize'/, 'falta reagir ao redimensionamento');
  });
});
