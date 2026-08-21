import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * As seis categorias saem do portfolio real, nao de uma taxonomia inventada.
 * Elas alimentam o filtro da vitrine, entao mudar um valor aqui exige atualizar
 * os rotulos em src/i18n/ui.ts.
 */
export const CATEGORIES = ['firmware', 'produto', 'publico', 'infra', 'cliente', 'aberto'] as const;

/**
 * Estado real do projeto, medido por commits e por estar no ar ou nao.
 * "parado" e usado sem eufemismo: projeto completo que nao recebe commit ha meses.
 */
export const STATUSES = ['producao', 'ativo', 'entregue', 'prelancamento', 'parado'] as const;

/** Texto de um projeto em um idioma. */
const locale = z.object({
  name: z.string().min(2),
  /** Uma frase concreta: o que resolve, para quem. Sem jargao de agencia. */
  pitch: z.string().min(40),
  /**
   * Nota de campo: o detalhe tecnico que prova competencia. Opcional de
   * proposito, porque nem todo projeto tem um achado que valha o espaco.
   */
  note: z.string().optional(),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    /** Ordem na vitrine, menor primeiro. */
    order: z.number().int().positive(),
    /** Entra nos seis cards grandes. */
    featured: z.boolean().default(false),
    category: z.enum(CATEGORIES),
    status: z.enum(STATUSES),
    /**
     * Referencia no estilo de serigrafia de placa (U1, R19, Q2). Nao e enfeite:
     * numera o projeto na vitrine e da ao card a leitura de ficha de componente.
     */
    designator: z.string().regex(/^[A-Z]{1,2}\d{1,3}$/),
    /** Dono real do repositorio, quando nao e a organizacao self-labs. */
    org: z.string().optional(),
    /** Servico no ar. Ausente quando nao ha nada publico para abrir. */
    link: z.string().url().optional(),
    /** Codigo aberto. Ausente em repositorio privado. */
    repo: z.string().url().optional(),
    /** Repositorio fechado: o card aparece, o link nao. */
    closed: z.boolean().default(false),
    stack: z.array(z.string()).min(2).max(9),
    pt: locale,
    en: locale,
  }),
});

export const collections = { projects };
