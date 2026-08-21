/**
 * Todo o texto de interface da pagina, nos dois idiomas.
 *
 * O conteudo dos projetos NAO mora aqui: ele vive em src/content/projects/*.json,
 * que ja carrega os campos "pt" e "en". Este arquivo cobre so a moldura.
 *
 * Regra de escrita, valida para os dois idiomas: nenhum travessao, nenhuma
 * meia risca. Virgula, dois pontos, parenteses ou frase nova resolvem.
 */

export const LOCALES = ['pt', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Descobre o idioma a partir da URL. A raiz e portugues, /en e ingles. */
export function localeFromUrl(url: URL): Locale {
  return url.pathname.startsWith('/en') ? 'en' : 'pt';
}

/** Monta um caminho no idioma corrente. */
export function rota(locale: Locale, caminho = ''): string {
  const limpo = caminho.replace(/^\//, '');
  const prefixo = locale === 'en' ? '/en' : '';
  return limpo ? `${prefixo}/${limpo}` : prefixo || '/';
}

export const ui = {
  pt: {
    meta: {
      titulo: 'Self-Labs - Laboratório de engenharia de Gustavo Cateim',
      descricao:
        'Firmware, sistemas web e infraestrutura que rodam em servidor próprio, com deploy por webhook e chave privada fora do servidor. Portfólio de 19 projetos, com o que quebrou em produção documentado.',
      idioma: 'pt-BR',
      trocarIdioma: 'English',
      trocarIdiomaLabel: 'Ver esta página em inglês',
    },

    nav: {
      pular: 'Ir direto ao conteúdo',
      abrirMenu: 'Abrir menu de navegação',
      fecharMenu: 'Fechar menu de navegação',
      itens: [
        { id: 'lab', rotulo: 'O lab' },
        { id: 'metodo', rotulo: 'Método' },
        { id: 'projetos', rotulo: 'Projetos' },
        { id: 'producao', rotulo: 'Produção' },
        { id: 'contato', rotulo: 'Contato' },
      ],
    },

    hero: {
      kicker: 'Vitória, Espírito Santo, Brasil',
      titulo: 'Um laboratório de uma pessoa só, com uptime.',
      texto:
        'Firmware de hardware wallet, sistemas de gestão para o setor público e infraestrutura que roda em servidor próprio. Tudo entra em produção pelo mesmo caminho: push na master, o CI testa, o webhook redeploya. Ninguém abre SSH às duas da manhã.',
      acaoPrimaria: 'Ver os projetos',
      acaoSecundaria: 'Falar comigo',
      legendaFigura: 'Isotipo do Self-Labs energizando trilha por trilha',
    },

    prova: {
      rotulo: 'Leitura',
      /**
       * Os quatro valores sao derivados, nunca digitados: dois vem da API do
       * GitHub (scripts/fetch-stats.mjs), um e contado nos proprios arquivos de
       * projeto e um e calculado da data do repositorio mais antigo.
       */
      nota: (data: string) => `Contados pela API do GitHub em ${data}, não estimados. Atualizam sozinhos toda segunda.`,
      itens: {
        commits: { unidade: 'commits', legenda: (n: number) => `em ${n} repositórios públicos` },
        prs: { unidade: 'PRs aceitos', legenda: 'em projetos de outras pessoas' },
        producao: { unidade: 'em produção', legenda: 'sistemas no ar em selflabs.org' },
        meses: { unidade: 'meses', legenda: 'de operação contínua e rastreável' },
      },
    },

    lab: {
      codigo: 'LAB',
      rotulo: 'O que é o Self-Labs',
      titulo: 'O "self" é literal',
      paragrafos: [
        'Self-hosted, self-custody, feito por conta própria. Nenhum banco de dados gerenciado sem necessidade, nenhum deploy que dependa de alguém logar no servidor, nenhuma chave privada dentro de uma máquina que fala com a internet.',
        'O que existe aqui é software que já quebrou em produção, foi consertado e continua rodando. Firmware assinado de hardware wallet Bitcoin. Uma loja que apaga os dados do comprador 72 horas depois da entrega. Um sistema de efetivo com cerca de 500 militares dentro. Imagens Docker que se reconstroem sozinhas todo domingo e não gastam runner quando nada mudou.',
        'Quando algo deu errado, está escrito no repositório que deu errado, com data e referência de arquivo. Isso não é humildade, é rastreabilidade.',
      ],
    },

    metodo: {
      codigo: 'MET',
      rotulo: 'Método',
      titulo: 'Cinco coisas que se repetem em todo projeto',
      subtitulo:
        'Não são princípios de parede. Cada um aparece no código de pelo menos três projetos, e os que servem de prova estão listados embaixo.',
      provaLabel: 'Prova',
      pilares: [
        {
          titulo: 'GitOps sem passo manual, em hardware próprio',
          texto:
            'O caminho é sempre o mesmo: push na master, o CI testa e constrói a imagem, o webhook do Portainer redeploya. No CI da Wallet Store o job de deploy falha alto em qualquer HTTP fora do 2xx. Build ARM64 acontece em runner nativo, nunca em emulação, porque o alvo real é um Orange Pi 5 ou uma VPS Ampere.',
          prova: ['Wallet Store', 'Soluções DIY', 'cateim/cups', 'ALFERES'],
        },
        {
          titulo: 'Verificação em vez de confiança',
          texto:
            'A loja e o rastreador de carteira operam apenas com xpub watch-only e derivam cada endereço localmente. A loja vai além: uma checagem roda no entrypoint, antes do servidor de aplicação, e recusa subir se as chaves configuradas derivarem um endereço diferente do esperado. Um xpub trocado por invasor não vira pagamento desviado em silêncio.',
          prova: ['Wallet Store', 'Crypto Tracker', 'Jade DIY'],
        },
        {
          titulo: 'Privacidade e autorização em código executável',
          texto:
            'Política em página de texto não protege ninguém. Um comando agendado destrói os dados pessoais do comprador 72 horas após a entrega. No ALFERES, administrar e comandar são dois eixos que nunca se misturam, e o escopo é aplicado em SQL com CTE recursiva sobre a subordinação, não na tela. No Escala e Folgas a autorização mora no app_metadata do token, porque o user_metadata é gravável pelo próprio usuário.',
          prova: ['Wallet Store', 'ALFERES', 'Escala e Folgas', 'Atlas Logistics'],
        },
        {
          titulo: 'Toda integração externa falha um dia',
          texto:
            'Preço tem cascata de três fontes com circuit breaker. O saldo on-chain é lido de um pool de três servidores Electrum. O monitor do portal WiFi só declara a internet caída se três alvos independentes falharem, e ainda espera três ciclos antes de acordar o administrador, porque soluço de rede não é queda.',
          prova: ['Crypto Tracker', 'Wallet Store', 'Captive Portal', 'ai-usagebar-win'],
        },
        {
          titulo: 'Diagnóstico até a causa raiz, inclusive no hardware',
          texto:
            'Na placa TTGO T-Display o app da carteira travava o botão de Boot. Em vez de aceitar a gambiarra de driver, o rastreamento foi até o circuito: o sinal RTS do conversor USB passa por um resistor de 10k até a base de um transistor, que puxa o GPIO0 para o chão. A correção troca o resistor por um capacitor de 100nF, convertendo acoplamento DC em AC. Bug de software resolvido no hardware.',
          prova: ['Jade DIY', 'cateim/cups', 'Captive Portal', 'PMES'],
        },
      ],
    },

    destaques: {
      codigo: 'VIT',
      rotulo: 'Em destaque',
      titulo: 'Seis que valem a leitura',
      subtitulo:
        'Escolhidos pelo que provam tecnicamente, não pelo tamanho. A nota de campo em cada um é o achado que sustenta o projeto.',
      notaLabel: 'Nota de campo',
    },

    portfolio: {
      codigo: 'ARQ',
      rotulo: 'Portfólio completo',
      titulo: 'Dezenove projetos',
      subtitulo:
        'De firmware em C rodando em ESP32 até imagem Docker multi-arquitetura. Repositórios privados aparecem sem link, porque o código é de cliente ou tem chave dentro.',
      filtroLabel: 'Filtrar projetos por categoria',
      todos: 'Todos',
      contagem: (n: number) => `${n} ${n === 1 ? 'projeto' : 'projetos'}`,
      privado: 'repositório fechado',
      verServico: 'Abrir serviço',
      verCodigo: 'Ver código',
      categorias: {
        firmware: 'Firmware e Bitcoin',
        produto: 'Produto próprio',
        publico: 'Setor público',
        infra: 'Infraestrutura',
        cliente: 'Cliente',
        aberto: 'Aberto',
      },
      status: {
        producao: 'em produção',
        ativo: 'ativo',
        entregue: 'entregue',
        prelancamento: 'pré-lançamento',
        parado: 'estável, sem commits recentes',
      },
    },

    producao: {
      codigo: 'CI',
      rotulo: 'Como chega em produção',
      titulo: 'Do push ao ar, sem ninguém no meio',
      subtitulo:
        'Desenvolvo no Windows, apenas na IDE. Nenhum serviço de servidor roda nesta máquina. Daqui em diante é tudo automático.',
      etapas: [
        { rotulo: 'push', texto: 'Commit na master do GitHub ou do Forgejo próprio.' },
        { rotulo: 'CI', texto: 'Testes, typecheck e build da imagem em runner nativo da arquitetura alvo.' },
        { rotulo: 'registry', texto: 'Imagem publicada com tag CalVer no padrão ano.mês.revisão.' },
        { rotulo: 'webhook', texto: 'O stack do Portainer recebe o gatilho e puxa a versão nova.' },
        { rotulo: 'no ar', texto: 'Cloudflare Tunnel conecta de saída. Nenhuma porta aberta no host.' },
      ],
      nota: 'Esta própria página segue o mesmo caminho: push na master, GitHub Actions builda o site e o Wrangler publica no apex.',
    },

    limites: {
      codigo: 'NÃO',
      rotulo: 'O que eu não faço',
      titulo: 'A lista curta importa mais que a longa',
      itens: [
        {
          titulo: 'Não provisiono serviço gerenciado sem necessidade',
          texto:
            'Banco, fila e storage rodam em servidor próprio por padrão. Quando um serviço de terceiro entra, a decisão fica escrita no repositório com o motivo.',
        },
        {
          titulo: 'Não entrego deploy que precise de intervenção',
          texto:
            'Se subir a versão nova exige alguém abrindo SSH, o trabalho não está terminado. Redeploy é webhook, sempre.',
        },
        {
          titulo: 'Não coloco chave privada no servidor',
          texto:
            'Sistema que lida com Bitcoin opera com xpub watch-only. A assinatura acontece no dispositivo do dono, fora da máquina que fala com a internet.',
        },
        {
          titulo: 'Não prometo o que ainda não roda',
          texto:
            'Projeto sem commit há meses aparece aqui marcado como estável e sem commits recentes, não como ativo. O que está parado está escrito que está.',
        },
      ],
    },

    externo: {
      codigo: 'EXT',
      rotulo: 'Validação externa',
      titulo: 'Código que passou pela revisão de outra pessoa',
      subtitulo:
        'Treze pull requests aceitos em oito repositórios de sete donos diferentes, mais acesso de escrita a um projeto de terceiro. Os quatro abaixo são os que mais dizem alguma coisa.',
      itens: [
        {
          onde: 'Blockstream / Jade',
          texto:
            'Pull request 260 aceito no repositório oficial do firmware da hardware wallet Jade, em dezembro de 2025. É o firmware que roda nas placas do Jade DIY.',
          link: 'https://github.com/Blockstream/Jade/pull/260',
        },
        {
          onde: 'Origo, de Oderico',
          texto:
            'Projeto de outra pessoa, onde eu corrijo bugs com acesso de escrita ao repositório. É o firmware que gera seed BIP39 a partir de dados que o humano jogou, criado depois que cerca de 88 milhões de dólares saíram de carteiras Coldcard por uma flag de build que rebaixou a entropia sem ninguém notar por cinco anos.',
          link: 'https://github.com/oroderico/origo',
        },
        {
          onde: 'ai-memory, de Fábio Akita',
          texto:
            'Três pull requests aceitos em junho de 2026. Um subcomando nativo derrubou o custo do hook no Windows de cerca de 735 ms para cerca de 175 ms por chamada de ferramenta. Os outros dois pararam de apagar hooks de terceiros e de poluir log alheio. Todos com teste junto.',
          link: 'https://github.com/akitaonrails/ai-memory/pulls?q=is%3Apr+author%3ACaTeIM',
        },
        {
          onde: 'FrankMD, Home Assistant e outros',
          texto:
            'Mais três pull requests aceitos no FrankMD e correções em dois componentes de Home Assistant mantidos por terceiros, sempre com o caso de teste que reproduz o problema.',
          link: 'https://github.com/pulls?q=is%3Apr+author%3ACaTeIM+is%3Amerged',
        },
      ],
    },

    contato: {
      codigo: 'FIM',
      rotulo: 'Contato',
      titulo: 'Se tiver um problema real para resolver, me escreva',
      texto:
        'Firmware embarcado, sistema web que precisa aguentar produção, infraestrutura self-hosted que ninguém quer manter. Responda o que precisa e eu digo se é para mim ou não.',
      emailLabel: 'Enviar e-mail para contato@selflabs.org',
      canais: {
        email: 'E-mail',
        whatsapp: 'WhatsApp',
        whatsappNota: 'resposta em horário comercial',
        whatsappLabel: 'Abrir conversa no WhatsApp com uma mensagem já escrita',
      },
      links: [
        { rotulo: 'GitHub pessoal', href: 'https://github.com/CaTeIM' },
        { rotulo: 'Organização Self-Labs', href: 'https://github.com/self-labs' },
        { rotulo: 'Loja de hardware wallet', href: 'https://store.selflabs.org' },
      ],
    },

    rodape: {
      direitos: 'Self-Labs, Vitória, Espírito Santo, Brasil.',
      construido: 'Página estática em Astro, servida pelo Cloudflare Workers no apex, publicada por webhook.',
      versaoLabel: 'versão',
      servicos: 'Serviços públicos',
    },
  },

  en: {
    meta: {
      titulo: 'Self-Labs - The engineering lab of Gustavo Cateim',
      descricao:
        'Firmware, web systems and infrastructure running on my own servers, deployed by webhook, with the private key kept off the box. A portfolio of 19 projects, including what broke in production.',
      idioma: 'en',
      trocarIdioma: 'Português',
      trocarIdiomaLabel: 'View this page in Portuguese',
    },

    nav: {
      pular: 'Skip to content',
      abrirMenu: 'Open navigation menu',
      fecharMenu: 'Close navigation menu',
      itens: [
        { id: 'lab', rotulo: 'The lab' },
        { id: 'metodo', rotulo: 'Method' },
        { id: 'projetos', rotulo: 'Projects' },
        { id: 'producao', rotulo: 'Shipping' },
        { id: 'contato', rotulo: 'Contact' },
      ],
    },

    hero: {
      kicker: 'Vitória, Espírito Santo, Brazil',
      titulo: 'A one person lab, with uptime.',
      texto:
        'Hardware wallet firmware, management systems for the public sector, and infrastructure that runs on my own servers. Everything ships the same way: push to master, CI runs the tests, a webhook redeploys. Nobody opens SSH at two in the morning.',
      acaoPrimaria: 'See the work',
      acaoSecundaria: 'Get in touch',
      legendaFigura: 'The Self-Labs mark powering up trace by trace',
    },

    prova: {
      rotulo: 'Reading',
      nota: (data: string) =>
        `Counted through the GitHub API on ${data}, not estimated. They refresh themselves every Monday.`,
      itens: {
        commits: { unidade: 'commits', legenda: (n: number) => `across ${n} public repositories` },
        prs: { unidade: 'PRs merged', legenda: 'into other people projects' },
        producao: { unidade: 'in production', legenda: 'systems live on selflabs.org' },
        meses: { unidade: 'months', legenda: 'of continuous, traceable operation' },
      },
    },

    lab: {
      codigo: 'LAB',
      rotulo: 'What Self-Labs is',
      titulo: 'The "self" is literal',
      paragrafos: [
        'Self-hosted, self-custody, self-made. No managed database unless there is no alternative, no deploy that depends on somebody logging into a server, no private key sitting on a machine that talks to the internet.',
        'What lives here is software that has already broken in production, been fixed, and kept running. Signed Bitcoin hardware wallet firmware. A shop that destroys buyer data 72 hours after delivery. A personnel system holding roughly 500 officers. Docker images that rebuild themselves every Sunday and burn no runner minutes when nothing changed.',
        'When something went wrong, the repository says it went wrong, with a date and a file reference. That is not modesty, it is traceability.',
      ],
    },

    metodo: {
      codigo: 'MET',
      rotulo: 'Method',
      titulo: 'Five things that repeat in every project',
      subtitulo:
        'Not wall posters. Each one shows up in the code of at least three projects, and the ones that prove it are listed underneath.',
      provaLabel: 'Proof',
      pilares: [
        {
          titulo: 'GitOps with no manual step, on my own hardware',
          texto:
            'The path never changes: push to master, CI tests and builds the image, the Portainer webhook redeploys. In the Wallet Store pipeline the deploy job fails loudly on any HTTP status outside 2xx. ARM64 builds run on native runners, never under emulation, because the real target is an Orange Pi 5 or an Ampere VPS.',
          prova: ['Wallet Store', 'DIY guides', 'cateim/cups', 'ALFERES'],
        },
        {
          titulo: 'Verification instead of trust',
          texto:
            'The shop and the wallet tracker run on watch-only xpubs and derive every address locally. The shop goes further: a check runs in the entrypoint, before the application server, and refuses to start if the configured keys derive an address other than the expected one. A swapped xpub does not silently turn into a redirected payment.',
          prova: ['Wallet Store', 'Crypto Tracker', 'Jade DIY'],
        },
        {
          titulo: 'Privacy and authorization as executable code',
          texto:
            'A policy page protects nobody. A scheduled command destroys the buyer personal data 72 hours after delivery. In ALFERES, administering and commanding are two axes that never mix, and scope is enforced in SQL through a recursive CTE over the chain of command, not in the view. In Escala e Folgas authorization lives in the token app_metadata, because user_metadata is writable by the user.',
          prova: ['Wallet Store', 'ALFERES', 'Escala e Folgas', 'Atlas Logistics'],
        },
        {
          titulo: 'Every external integration fails eventually',
          texto:
            'Pricing falls through three sources behind a circuit breaker. On-chain balance is read from a pool of three Electrum servers. The WiFi portal monitor only calls the internet down when three independent targets fail, and still waits three cycles before waking the administrator, because a hiccup is not an outage.',
          prova: ['Crypto Tracker', 'Wallet Store', 'Captive Portal', 'ai-usagebar-win'],
        },
        {
          titulo: 'Root cause, even when it sits in the hardware',
          texto:
            'On the TTGO T-Display board the wallet app kept locking the Boot button. Rather than accept a driver workaround, the trail led into the circuit: the RTS line from the USB bridge runs through a 10k resistor into a transistor base that pulls GPIO0 to ground. The fix swaps that resistor for a 100nF capacitor, turning DC coupling into AC. A software bug solved in hardware.',
          prova: ['Jade DIY', 'cateim/cups', 'Captive Portal', 'PMES'],
        },
      ],
    },

    destaques: {
      codigo: 'SEL',
      rotulo: 'Selected work',
      titulo: 'Six worth reading',
      subtitulo:
        'Chosen for what they prove technically, not for size. The field note on each one is the finding that holds the project up.',
      notaLabel: 'Field note',
    },

    portfolio: {
      codigo: 'ARC',
      rotulo: 'Full portfolio',
      titulo: 'Nineteen projects',
      subtitulo:
        'From C firmware on an ESP32 to multi-architecture Docker images. Private repositories appear without a link, because the code belongs to a client or holds keys.',
      filtroLabel: 'Filter projects by category',
      todos: 'All',
      contagem: (n: number) => `${n} ${n === 1 ? 'project' : 'projects'}`,
      privado: 'closed repository',
      verServico: 'Open service',
      verCodigo: 'View code',
      categorias: {
        firmware: 'Firmware and Bitcoin',
        produto: 'Own product',
        publico: 'Public sector',
        infra: 'Infrastructure',
        cliente: 'Client work',
        aberto: 'Open',
      },
      status: {
        producao: 'in production',
        ativo: 'active',
        entregue: 'delivered',
        prelancamento: 'pre-launch',
        parado: 'stable, no recent commits',
      },
    },

    producao: {
      codigo: 'CI',
      rotulo: 'How it ships',
      titulo: 'From push to live, with nobody in between',
      subtitulo:
        'I develop on Windows, in the IDE only. No server software runs on this machine. From here on it is all automatic.',
      etapas: [
        { rotulo: 'push', texto: 'Commit to master on GitHub or on my own Forgejo.' },
        { rotulo: 'CI', texto: 'Tests, typecheck and image build on a runner native to the target architecture.' },
        { rotulo: 'registry', texto: 'Image published with a CalVer tag in the year.month.revision format.' },
        { rotulo: 'webhook', texto: 'The Portainer stack takes the trigger and pulls the new version.' },
        { rotulo: 'live', texto: 'Cloudflare Tunnel connects outbound. No port open on the host.' },
      ],
      nota: 'This page follows the same path: push to master, GitHub Actions builds the site, Wrangler publishes it on the apex.',
    },

    limites: {
      codigo: 'NO',
      rotulo: 'What I do not do',
      titulo: 'The short list matters more than the long one',
      itens: [
        {
          titulo: 'I do not provision managed services by default',
          texto:
            'Database, queue and storage run on my own servers first. When a third party service does come in, the reasoning is written down in the repository.',
        },
        {
          titulo: 'I do not ship a deploy that needs a human',
          texto:
            'If rolling out a new version means someone opening SSH, the job is not finished. Redeploy is a webhook, always.',
        },
        {
          titulo: 'I do not put private keys on servers',
          texto:
            'Anything touching Bitcoin runs on watch-only xpubs. Signing happens on the owner device, off the machine that talks to the internet.',
        },
        {
          titulo: 'I do not promise what is not running',
          texto:
            'A project with no commits for months shows up here as stable with no recent commits, not as active. What is idle says it is idle.',
        },
      ],
    },

    externo: {
      codigo: 'EXT',
      rotulo: 'External validation',
      titulo: 'Code that went through someone else review',
      subtitulo:
        'Thirteen pull requests merged into eight repositories owned by seven different people, plus write access to a project that is not mine. These four say the most.',
      itens: [
        {
          onde: 'Blockstream / Jade',
          texto:
            'Pull request 260 merged into the official repository of the Jade hardware wallet firmware, in December 2025. That is the firmware running on the Jade DIY boards.',
          link: 'https://github.com/Blockstream/Jade/pull/260',
        },
        {
          onde: 'Origo, by Oderico',
          texto:
            'Someone else project, where I fix bugs with write access to the repository. It is the firmware that turns dice you rolled yourself into a BIP39 seed, built after roughly 88 million dollars drained out of Coldcard wallets because a build flag quietly lowered the entropy and went five years unnoticed.',
          link: 'https://github.com/oroderico/origo',
        },
        {
          onde: 'ai-memory, by Fábio Akita',
          texto:
            'Three pull requests merged in June 2026. A native subcommand cut the Windows hook cost from roughly 735 ms to roughly 175 ms per tool call. The other two stopped it from deleting third party hooks and from polluting somebody else log. Each one shipped with a test.',
          link: 'https://github.com/akitaonrails/ai-memory/pulls?q=is%3Apr+author%3ACaTeIM',
        },
        {
          onde: 'FrankMD, Home Assistant and others',
          texto:
            'Three more merged into FrankMD, plus fixes to two third party Home Assistant components, always shipped with the test case that reproduces the problem.',
          link: 'https://github.com/pulls?q=is%3Apr+author%3ACaTeIM+is%3Amerged',
        },
      ],
    },

    contato: {
      codigo: 'END',
      rotulo: 'Contact',
      titulo: 'If you have a real problem to solve, write to me',
      texto:
        'Embedded firmware, a web system that has to survive production, self-hosted infrastructure nobody wants to maintain. Tell me what you need and I will say whether it is for me or not.',
      emailLabel: 'Send an email to contato@selflabs.org',
      canais: {
        email: 'Email',
        whatsapp: 'WhatsApp',
        whatsappNota: 'replies during business hours',
        whatsappLabel: 'Open a WhatsApp conversation with a message already written',
      },
      links: [
        { rotulo: 'Personal GitHub', href: 'https://github.com/CaTeIM' },
        { rotulo: 'Self-Labs organisation', href: 'https://github.com/self-labs' },
        { rotulo: 'Hardware wallet shop', href: 'https://store.selflabs.org' },
      ],
    },

    rodape: {
      direitos: 'Self-Labs, Vitória, Espírito Santo, Brazil.',
      construido: 'Static Astro page served by Cloudflare Workers on the apex, published by webhook.',
      versaoLabel: 'version',
      servicos: 'Public services',
    },
  },
} as const;

export type Ui = (typeof ui)['pt'];
