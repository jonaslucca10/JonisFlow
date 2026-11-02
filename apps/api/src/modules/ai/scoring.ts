import { config } from '../../config';
import { logger } from '../../lib/logger';

/**
 * ai-scoring — módulo próprio de pontuação de leads.
 *
 * Estrutura plugável:
 *  1. Heurísticas (sempre funcionam, zero custo, zero dependência de rede).
 *  2. LLM via API OpenAI-compatível (opcional; acréscimo de qualidade).
 *
 * Prompts versionados (AI_PROMPT_VERSION) para auditar mudanças de comportamento.
 * Chaves do LLM NUNCA no frontend — chamado apenas server-side.
 */

export interface LeadInput {
  websitePresent: boolean;
  phonePresent: boolean;
  rating: number | null;
  userRatings: number | null;
  category: string;
  city: string;
  name?: string;
}

export interface ScoreOutput {
  score: number; // 0-100 — probabilidade de a empresa precisar de um site
  reason: string;
  suggestedPitch: string;
  method: 'heuristic' | 'llm';
  model?: string;
}

const PITCH_TEMPLATES: Record<string, (d: LeadInput) => string> = {
  restaurante: (d) =>
    `Olá, notamos seu restaurante "${d.name ?? ''}" em ${d.city}. Vocês já tem cardápio digital/site? Em 5 minutos criamos uma página com cardápio online e pedidos por WhatsApp.`,
  salão: (d) =>
    `Olá! Seu salão em ${d.city} parece incrível. Uma página com serviços, preços e agenda online atrai clientes todos os dias — podemos fazer um teste gratuito?`,
  generic: (d) =>
    `Olá, sua empresa em ${d.city} ainda não tem site. Em menos de uma semana você pode estar nos primeiros resultados do Google e receber clientes todos os dias. Podemos conversar?`,
};

function pickPitch(d: LeadInput) {
  const cat = d.category.toLowerCase();
  if (cat.includes('restaurante') || cat.includes('lanchonete')) return PITCH_TEMPLATES.restaurante(d);
  if (cat.includes('salão') || cat.includes('barbearia') || cat.includes('cabeleireiro')) return PITCH_TEMPLATES.salão(d);
  return PITCH_TEMPLATES.generic(d);
}

/** Heurística: o sinal principal é "sem site". Telefone = canto de contato. Avaliações = demanda. */
export function heuristicScore(d: LeadInput): ScoreOutput {
  if (d.websitePresent) {
    return {
      score: 10,
      reason: 'Possui site — lead NÃO qualificado para "sem site".',
      suggestedPitch: '',
      method: 'heuristic',
    };
  }
  let score = 55; // base: sem site = forte sinal de necessidade digital
  const reasons: string[] = ['Empresa sem site'];

  if (d.phonePresent) { score += 15; reasons.push('tem telefone (canal de contato)'); }
  if (d.userRatings != null && d.userRatings >= 10) { score += 10; reasons.push(`${d.userRatings} avaliações (demanda)`); }
  if (d.rating != null && d.rating >= 4.0) { score += 5; reasons.push(`avaliação ${d.rating.toFixed(1)}`); }
  if (d.rating != null && d.rating <= 2.0) { score -= 5; reasons.push(`avaliação baixa ${d.rating.toFixed(1)} (risco de atendimento)`); }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    reason: reasons.join('; '),
    suggestedPitch: pickPitch(d),
    method: 'heuristic',
  };
}

/** LLM: OpenAI-compatível (OpenAI, Groq, Claude-via-proxy, etc). Opcional. */
const PROMPT_VERSION = config.AI_PROMPT_VERSION;

function llmPrompt(d: LeadInput) {
  return [
    { role: 'system' as const, content: `Versão ${PROMPT_VERSION}. Você é um especialista em prospecção B2B. Dado um lead de empresa local, responda JSON: {"score": int 0-100 (probabilidade de precisar de site), "reason": string curta, "suggested_pitch": string de abordagem em português BR, max 2 frases}` },
    { role: 'user' as const, content: JSON.stringify(d) },
  ];
}

async function llmScore(d: LeadInput): Promise<ScoreOutput | null> {
  if (!config.AI_LLM_ENABLED || !config.AI_LLM_API_KEY) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${config.AI_LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.AI_LLM_API_KEY}` },
      body: JSON.stringify({ model: config.AI_LLM_MODEL, messages: llmPrompt(d), temperature: 0.2, response_format: { type: 'json_object' } }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { logger.warn({ status: res.status }, 'LLM scoring error'); return null; }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as { score: number; reason: string; suggested_pitch: string };
    if (typeof parsed.score !== 'number') return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      reason: parsed.reason,
      suggestedPitch: parsed.suggested_pitch,
      method: 'llm',
      model: config.AI_LLM_MODEL,
    };
  } catch (e) {
    logger.warn({ err: String(e) }, 'LLM scoring falha — fallback heurística');
    return null; // sempre heurística como floor
  }
}

export async function scoreLead(d: LeadInput): Promise<ScoreOutput> {
  const llm = await llmScore(d);
  return llm ?? heuristicScore(d);
}
