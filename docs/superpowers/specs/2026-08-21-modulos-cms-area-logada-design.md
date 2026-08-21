<!-- v2026.8.1 - escopo de CMS, arquitetura modular e area logada. Pesquisado, nao executado. -->

# Módulos, CMS e área logada

**Data:** 21 de agosto de 2026
**Estado:** escopo aprovado para registro, nada implementado
**Origem:** pesquisa em cinco frentes paralelas, com leitura do código real de `radar`, `alferes`, `pmes`, `jordao`, `escala-folgas` e `criarviral`

## O problema

Três pedidos, feitos juntos porque se encostam:

1. Editar a landing page sem abrir a IDE e sem push manual.
2. Crescer por módulos: quando precisar acrescentar algo, acrescenta uma pasta. Vale para todos os projetos, que estão em evolução constante. Nas palavras do dono: "a mesma cara, porém com mais funções".
3. Talvez uma área logada onde a pessoa acessa os módulos. Quais módulos, ainda não se sabe.

## Critérios de decisão, nesta ordem de peso

1. **Aderência às regras do repositório.** Uma solução que quebra o GitOps ou obriga a manter mais um serviço perde para uma pior tecnicamente que respeita o fluxo.
2. **Continuidade com o que já existe.** Se o admin do `radar` já vive atrás do Cloudflare Access, a resposta provavelmente é Cloudflare Access.
3. **Custo de manutenção para uma pessoa só.** Cada serviço novo é mais uma coisa que quebra às duas da manhã.
4. **Reversibilidade.** Se der errado em seis meses, quanto custa sair?

---

## Decisão 1: edição sem IDE

**Sveltia CMS**, fixado em versão exata, servido em `/painel/conteudo/` como arquivo estático do próprio site, autenticando com um token fine-grained do GitHub e commitando direto na `master`. A rota fica atrás do Cloudflare Access.

### Por quê

É a única opção que atende ao pedido sem tocar em nenhuma premissa do projeto:

- O `wrangler.jsonc` continua sem `main`. O Worker segue servindo apenas arquivos.
- O `astro.config.mjs` continua `output: 'static'`.
- O conteúdo continua nos dezenove JSON validados pelo Zod de `src/content.config.ts`.
- O portão de qualidade continua sendo o CI, que roda `npm run check` e `npm test` antes de construir.

Salvar no painel é um commit na `master`, e o `deploy.yml` faz o resto. As chamadas de escrita vão do navegador direto para `api.github.com`, então o Access na frente do `/painel` não precisa de exceção de bypass. O Pages CMS, por comparação, recebe webhook servidor a servidor e receberia 403.

### Como funciona

Uma página Astro em `src/pages/painel/conteudo/index.astro` importa o pacote do Sveltia, e um `config.yml` em `public/painel/conteudo/` descreve a coleção. Abre a rota, cola o token uma vez (fica no `localStorage`), edita num formulário e salva.

**Modelagem obrigatória, verificada nos arquivos reais:** os JSON têm chaves irmãs fora dos idiomas (`order`, `featured`, `category`, `status`, `designator`, `org`, `repo`, `closed`, `stack`, com `pt` e `en` dentro). A estrutura `i18n: single_file` nativa do Sveltia **não** reproduz essa forma. Modele com dois campos `object` chamados `pt` e `en` dentro de uma coleção comum. Isso preserva o formato byte a byte e custa apenas o seletor de idioma da interface, irrelevante para dezenove arquivos.

No celular funciona como PWA, com login por QR code a partir do desktop. A documentação ressalva que a interface ainda não é otimizada para telas pequenas.

### Esforço

3 a 5 horas para a primeira versão, mais 1 hora para o teste de sincronia:

| Etapa | Tempo |
|---|---|
| Prova de conceito num branch, apontando para UM arquivo | 30 min |
| `config.yml` completo (nove campos comuns, três por idioma) | 2 a 3 h |
| Rota, `noindex` e exclusão do `/painel` do sitemap | 30 min |
| Aplicação e política no Cloudflare Access | 30 min |
| Teste que lê o schema Zod e falha se um campo não estiver no `config.yml` | 1 h |

### Riscos

- **Formatação do JSON.** Não sabemos como o Sveltia serializa (ordem de chaves e indentação). A prova de conceito com um arquivo responde isso antes de sujar dezenove. Se reordenar, a saída é ordenar os campos do `config.yml` na mesma ordem atual e aceitar um commit único de normalização.
- **Schema duplicado.** Nenhum CMS git-based pesquisado lê Zod. No Keystatic o pedido é a issue #336, aberta desde 16/06/2023. O `config.yml` vai repetir o que `src/content.config.ts` já descreve. Mitigação barata: um teste comparando as duas listas de campos, no mesmo estilo do `tests/conteudo.test.mjs`.
- **Pré-1.0, um mantenedor, várias releases por semana** (v0.194.0 em 21/08/2026). Versão exata no `package.json`, sem caret. A promessa de v1.0 para o início de 2026 não se confirmou.
- **O token é a fronteira de segurança real, não o Access.** O Access protege a entrega do HTML do painel; quem autoriza a escrita é o token. Use fine-grained, escopo apenas no repositório `self-labs`, permissão Contents read and write, validade de 90 dias, com a data de rotação registrada no `CLAUDE.md`.
- **Salvar publica.** O Sveltia trabalha em branch único: cada save vai para `master` e dispara build. Não existe rascunho, e o retorno do Zod chega minutos depois, no CI.

### Se não gostar

Painel próprio no padrão do `radar`: dar um `main` ao Worker, servir `/painel` com a casca vanilla mais esbuild já escrita duas vezes, gerar o formulário a partir do próprio Zod e commitar pela API do GitHub. Melhor em continuidade e sem duplicar schema, mas custa 3 a 5 dias, introduz runtime num site que hoje não tem nenhum, e guarda um token de escrita no Worker.

Enquanto nenhuma das duas existir, o editor web do GitHub em `github.dev` resolve o caso de urgência com custo zero.

---

## Decisão 2: arquitetura modular

**Um módulo é uma pasta autocontida em `src/modules/<id>/` que declara tudo que precisa num manifesto, entrega uma tela e nunca é importada por outro módulo.** Acrescentar função é acrescentar pasta; remover é apagar pasta.

### O ponto de partida não é uma folha em branco

O padrão já existe no código, escrito quatro vezes com quatro nomes:

| Projeto | Nome | Arquivo |
|---|---|---|
| alferes | `MODULOS` | `web/ui/shell.js` |
| radar | `ROUTES` | `admin/src/main.js` |
| jordao | `NAV` | `src/admin/shell.js` |
| pmes | `SPA_ROUTES` | |

Três ingredientes se repetem sozinhos nos quatro: um array de manifestos como fonte única da navegação, um contrato fixo de montar e desmontar, e uma placeholder única para o que ainda não foi construído. O alferes já mostra os nove módulos na navegação desde a Fase 0, apontando para "em construção".

A proposta é **nomear e extrair** o que já foi escrito quatro vezes, não adotar padrão importado.

### Contrato do módulo

- **`module.mjs` é a única interface pública.** Nada de fora importa arquivo de dentro do módulo a não ser através do manifesto. Campos: `id`, `ordem`, `titulo {pt,en}`, `slug {pt,en}`, `area` (`site` ou `painel`), `auth` (`publico` ou `access`), `nav`, `ativo`, `ilhas`, `orcamentoJS`. Validado por Zod próprio.
- **Módulo não importa de módulo.** Código comum vai para `src/shared`. Isso vira teste: um arquivo que lê os imports e falha o build se o id de um módulo aparecer no import de outro, no mesmo espírito da varredura que já barra a palavra proibida.
- **Prefixo obrigatório com o id** em nome de coleção e chave de i18n. Evita colisão silenciosa.
- **No máximo duas ilhas por módulo**, cada uma com orçamento de bytes declarado e conferido contra o `dist` depois do build. Sem isso, o zero JavaScript por padrão morre por acúmulo, um módulo de cada vez.
- **Módulo novo nasce com `auth: 'publico'` e `ativo: false`.** Mudar qualquer um é decisão consciente que aparece no diff. Enquanto `ativo` for false, a navegação mostra o item apontando para a placeholder.
- **Cada módulo carrega um `DECISOES.md`** com o que deu errado, data e referência de arquivo.

### Estrutura

```
src/
  content.config.ts           ponto de contato 1: mescla os collections de cada módulo
  pages/
    index.astro               a home de hoje, intocada
    en/index.astro            idem
    [...modulo].astro         ponto de contato 2: rota coringa dos módulos públicos
    en/[...modulo].astro      idem em inglês
    painel/[...modulo].astro  rota coringa do painel, só em português
  layouts/Base.astro          ponto de contato 3: a navegação lê a lista de manifestos
  shared/
    modulos.mjs               faz o glob dos manifestos, valida e ordena
    manifesto.ts              o schema Zod do manifesto
  modules/
    _template/                pasta modelo, copiada para criar módulo novo
    conteudo/
      module.mjs
      pages/painel.astro
      DECISOES.md
    status/
      module.mjs
      pages/status.astro
      content.mjs             exporta { collections }
      content/servicos.json
      i18n/pt.json
      i18n/en.json
      islands/                no máximo duas, com orçamento declarado
      tests/status.test.mjs
      DECISOES.md
tests/
  conteudo.test.mjs           o que já existe
  fronteira.test.mjs          módulo não importa de módulo
  orcamento.test.mjs          o JS emitido por módulo cabe no orçamento
```

**São três pontos de contato compartilhados, escritos uma única vez.** Um módulo sem conteúdo próprio não toca em nenhum deles.

### Como adicionar um módulo

1. Copiar `src/modules/_template` para `src/modules/<id>`, id em kebab-case sem acento.
2. Preencher `module.mjs`. Nasce com `ativo: false`. A partir desse commit o item já aparece na navegação apontando para a placeholder, que é literalmente a "mesma cara, porém com mais funções".
3. Escrever a tela em `pages/`, os dicionários em `i18n/` com chaves prefixadas pelo id, e o teste em `tests/`.
4. Se o módulo tiver conteúdo próprio, exportar `{ collections }` em `content.mjs` e acrescentar **uma linha** em `src/content.config.ts`. Este é o único arquivo compartilhado que um módulo com conteúdo obriga a tocar, porque a API de integrations do Astro não tem hook para declarar coleção: existe apenas `refreshContent`, e a proposta `injectContent` segue como discussão de roadmap (withastro/roadmap #688), não entregue.
5. Rodar `npm run verify` no Windows. Nada disso precisa de serviço rodando.
6. Virar `ativo: true` e commitar na `master`.
7. Só quando um módulo precisar de rota fora do padrão é que entra a integration carregadora escrita à mão, chamando `injectRoute`. Não escrever antes disso, e não usar `astro-integration-kit`, arquivado em 21/04/2026.

### Esforço

1 a 2 dias para a casca inteira, sem contar módulo nenhum. Custo por módulo depois disso: a pasta e o commit. Custo de infraestrutura: zero.

### O que se aplica aos outros projetos

O formato do manifesto e a casca. O que **não** se reaproveita é a regra de autorização, e é importante não tentar: alferes usa sessão em cookie com escopo por unidade administradora, jordao usa RLS no Postgres, escala-folgas usa `app_metadata` do JWT, e aqui é Access na borda. O manifesto declara qual nível o módulo exige; quem implementa o nível é cada projeto.

O mecanismo de rota é específico do Astro. Nos SPA vanilla o equivalente é o registro por loader com `import()` dinâmico já em uso.

---

## Decisão 3: área logada

**Cloudflare Access sobre `/painel`**, com a Cloudflare como identity provider e passkey como MFA. Zero linha de código de autenticação, o site continua estático, o `wrangler.jsonc` continua sem `main`.

### Por quê

É o critério 2 respondendo sozinho: o `/admin` do radar já roda exatamente isso, e o `radar/CLAUDE.md` registra que a proteção é Access na borda, sem validação de JWT no backend. A checagem acontece antes de o asset ser servido, então uma página pré-renderizada em `/painel/` fica inalcançável sem login sem que exista servidor nenhum.

O ganho estrutural é o casamento com a decisão 2: **uma política de caminho em `/painel` faz todo módulo futuro nascer protegido**, sem trabalho de auth por módulo.

As alternativas caem por motivo concreto:

- **Supabase** esbarra no limite de 2 projetos ativos do plano gratuito, que `jordao` e `escala-folgas` já ocupam, e projetos gratuitos pausam após uma semana de inatividade, que é o perfil exato de um painel aberto uma vez por mês.
- **Authelia mais lldap** é incompatível com a topologia: a landing é servida na borda da Cloudflare e não passa pelo Caddy do homelab. Adotá-lo faria o Orange Pi 5 virar ponto único de falha para administrar um site que continua no ar sem ele.
- **Auth.js ou Better Auth** significa virar dono de sessão, cookie e CVE de biblioteca de auth para dar login a uma pessoa.
- **Lucia** está descontinuada desde março de 2025.

### A conferir, dois minutos

Não foi confirmado se o plano gratuito do Zero Trust ainda são 50 assentos (a citação oficial encontrada é de 13/10/2020), nem se a política de caminho herda subcaminhos de `/painel` automaticamente. Conferir em Zero Trust, Settings, Subscription, e no editor da aplicação.

### Se um dia virar área de cliente

Não se troca o Access, separam-se dois planos. O Access foi desenhado para funcionários e parceiros: cada cliente externo consome um assento da organização, aparece no painel de identidade e precisa ser autorizado um a um. Não existe cadastro self-service, isolamento por inquilino nem faturamento.

O desenho que se sustenta: `/painel` continua no Access para sempre, e o dia em que existir o primeiro cliente pagante nasce um `app.selflabs.org` separado, com autenticação de aplicação de verdade. A fronteira entre os dois planos é de URL, então o Access não cria dívida nenhuma para esse futuro.

Quando algum módulo precisar gravar dados, e só então: o Worker ganha um `main`, a rota específica recebe `export const prerender = false`, o wrangler ganha `run_worker_first` restrito a esses caminhos, e a identidade é lida validando o header `Cf-Access-Jwt-Assertion` com `jose` contra o JWKS da equipe, conferindo issuer e audience. Nunca o cookie `CF_Authorization`, e não contar com `ctx.access`, que a documentação lista como não atravessando o roteador de Static Assets.

**Atenção de versão:** o repositório está em `astro ^5.13.2`, então o adaptador compatível é a linha 12.x do `@astrojs/cloudflare`. A 13.x pede Astro 6 e a 14.x pede Astro 7.

### Esforço

30 a 60 minutos: criar a aplicação self-hosted no Zero Trust apontando para `selflabs.org/painel`, escrever a política, habilitar passkey, acrescentar `noindex` nas rotas do painel e excluir `/painel` do sitemap. Custo recorrente: zero.

---

## Módulos candidatos

Ordenados por valor sobre esforço.

| # | Módulo | O que faz | Login | Servidor | Esforço | Valor |
|---|---|---|---|---|---|---|
| 1 | **Conteúdo** | O CMS. É o módulo 0, que prova a casca | sim | não | 3 a 5 h | alto |
| 2 | **Status** | Uptime dos sistemas em produção, via cron que commita quando muda | não | não | meio dia | alto |
| 3 | **Diário de campo** | Notas técnicas datadas, com referência de arquivo | não | não | 1 dia | alto |
| 4 | **Releases de firmware** | Binários do Jade DIY por placa, com SHA256 ao lado | não | não | 1 dia | alto para hardware wallet |
| 5 | **Catálogo Docker** | Imagens públicas com tag, arquiteturas e último push | não | não | meio dia | médio |
| 6 | **Guias de self-hosting** | Os tutoriais fora dos READMEs, coleção própria | não | não | 1 a 2 dias | alto no longo prazo |
| 7 | **Propostas para cliente** | Página de escopo por cliente, URL não listada, `noindex` | não | não | 1 a 2 dias | médio a alto |
| 8 | **Mudanças recentes** | Changelog agregado dos repositórios, filtrado por release | não | não | meio dia | médio |
| 9 | **Métricas de uptime** | Série histórica e alerta. Primeiro módulo que exige Worker com `main` | sim | sim | 3 a 5 dias | baixo agora, adiar |

**Status** é o maior retorno por hora: a barra de prova já afirma "sistemas em produção" contando arquivos. Um status real transforma essa afirmação em evidência verificável, que é a regra 5 do `CLAUDE.md` aplicada ao número mais importante da página. E o padrão de implementação já existe pronto: é o mesmo `fetch-stats.mjs` mais `stats.yml`.

**Diário de campo** é o que prova competência para quem lê de verdade, e o material bruto já está escrito, preso dentro dos `CLAUDE.md` e dos campos `note`. A nota do Jade DIY sobre o R19 virando capacitor de 100nF vale mais que qualquer texto de venda, e hoje cabe num campo de card.

---

## Ordem de execução

1. **Access sobre `/painel`**, antes de existir qualquer coisa lá. Fazer depois é a ordem que produz vazamento.
2. **Prova de conceito do Sveltia num branch, com um arquivo só.** Trinta minutos que decidem a frente inteira.
3. **Módulo Conteúdo em produção**, com o teste de sincronia entre `config.yml` e Zod.
4. **A casca de módulos**, com o Conteúdo migrado para dentro como módulo 0. Casca depois do primeiro módulo, e não antes, evita projetar contrato para caso imaginário.
5. **Módulo Status**, o teste honesto da casca. Se acrescentar Status exigir editar mais de um arquivo compartilhado, o contrato está errado, e você descobre com um módulo barato.
6. **Diário de campo**, depois **Releases de firmware**.
7. **Upgrade do Astro em PR separado, sozinho.** O repositório está em `^5.13.2` e o registro já traz `7.2.4` (19/08/2026). Astro 6 troca para Zod 4, Vite 7 e Shiki 4; Astro 7 reescreveu o compilador em Rust e endureceu o parse de HTML, transformando tag não fechada em erro. Todas as convenções propostas aqui sobrevivem aos dois upgrades de propósito.
8. **Guias e Propostas**, quando houver conteúdo pronto. Módulo sem conteúdo é pasta vazia com item de navegação, e isso envelhece mal.

---

## O que não fazer

- **Não tirar o conteúdo do git.** Dezenove JSON com quinze campos cada não têm volume, concorrência entre editores nem consulta relacional: os três problemas que um banco resolve. O que existe é problema de interface, e problema de interface se resolve com interface.
- **Não instalar Keystatic, Payload, Tina ou Directus.** Keystatic obriga adaptador e sai do estático puro, com issue de OAuth no Cloudflare aberta desde 10/01/2026. Payload e Tina trazem Next e React inteiros, e no Tina a edição visual envolve a página em React, matando as ilhas. Directus 12 tem enforcement ativo de licença, com estado de bloqueio.
- **Não usar caret na dependência do CMS.** Versão exata. Projeto pré-1.0 com várias releases por semana não é candidato a atualização automática.
- **Não deixar o `config.yml` e o Zod se separarem sem alarme.** O dia em que o schema mudar e o config não, o painel grava algo que quebra o build.
- **Não criar formulário de contato como módulo.** O `CLAUDE.md` já explica por quê, e a explicação continua correta.
- **Não usar middleware do Astro para proteger rota enquanto o site for estático.** Em página pré-renderizada o middleware roda apenas durante o build, e o HTML servido depois nunca mais passa por ele. Quem protege é o Access na frente. Esta é a armadilha de segurança mais fácil de cair aqui.
- **Não colocar cliente externo no Cloudflare Access.** Cada um consome assento, aparece no painel de identidade e precisa ser autorizado à mão.
- **Não usar query string para estado de módulo.** Política de caminho do Access não enxerga query string e aceita no máximo um curinga entre barras. É restrição de desenho de URL.
- **Não adotar biblioteca morta do nicho:** `astro-integration-kit` arquivado em 21/04/2026, `astro-pages` parado na 0.3.1 de 10/12/2024, `astro-theme-provider` sem push desde 11/03/2025.
- **Não montar monorepo com workspaces agora.** Um desenvolvedor, um consumidor, duas rotas: o custo aparece na primeira hora e o benefício talvez nunca. Promover pasta a pacote é refatoração mecânica no dia em que um segundo projeto precisar do mesmo módulo.
- **Não misturar a reorganização em módulos com o upgrade de Astro no mesmo push.** São duas fontes independentes de quebra, e juntas não se sabe qual quebrou.
- **Não esquecer o `/painel` no sitemap e no `noindex`.**
- **Não colocar checkout ou pagamento da hardware wallet na landing.** Isso é produto com estado, estoque e obrigação fiscal, ou seja, projeto próprio com banco e servidor.
