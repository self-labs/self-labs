/**
 * Canais de contato.
 *
 * Ficam separados do resto do texto porque sao dado, nao copy: mudam de valor
 * sem mudar de idioma, e um deles carrega um numero de telefone real.
 *
 * Se WHATSAPP voltar a ficar vazio, o botao some da pagina em vez de virar um
 * link quebrado. Isso e proposital: telefone errado no ar manda visitante
 * conversar com um desconhecido.
 */

/** Somente digitos, com codigo do pais e DDD. Numero pessoal. */
export const WHATSAPP = '5528999919444';

export const EMAIL = 'contato@selflabs.org';

/**
 * Mensagem que ja vem escrita ao abrir a conversa. Serve de filtro: quem chega
 * pelo site abre falando de projeto, e nao com um "oi" solto.
 */
export const PRIMEIRA_MENSAGEM = {
  pt: 'Olá, Gustavo. Vim pelo selflabs.org e gostaria de conversar sobre um projeto.',
  en: 'Hello, Gustavo. I came from selflabs.org and would like to talk about a project.',
} as const;

/** Monta a URL do WhatsApp, ou devolve null quando nao ha numero configurado. */
export function linkWhatsapp(locale: 'pt' | 'en'): string | null {
  const numero = WHATSAPP.replace(/\D/g, '');
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(PRIMEIRA_MENSAGEM[locale])}`;
}
