import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { config, googleSnapshotTtlDays, snapshotEnabled } from '../../config';
import { HttpError } from '../../middlewares/error';
import { logger } from '../../lib/logger';
import { scoreLead } from '../ai/scoring';

/**
 * Busca de empresas locais via Google Places Text Search (API oficial — caminho padrão).
 *
 * Conformidade ToS:
 *  - Não armazenamos nome/endereço/avaliação permanentemente: lead guarda place_id +
 *    coordenadas + flags booleanas + pontuação da IA.
 *  - lead_snapshots (display data) tem TTL máx 30 dias (GOOGLE_SNAPSHOT_TTL_DAYS),
 *    purgado nightly. Set 0 para modo estrito (sem snapshots).
 *  - Scraping (Apify/próprio) é alternativa com risco jurídico — desativado por padrão.
 */

export const SearchSchema = z.object({
  query: z.string().min(2).max(120),
  city: z.string().min(2).max(120),
  category: z.string().min(2).max(120),
  filters: z.object({
    semSite: z.boolean().default(true), // filtro principal: sem website
    temTelefone: z.boolean().default(true),
  }).default({ semSite: true, temTelefone: true }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface PlacesResult {
  place_id: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  website?: string;
  international_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
}

interface GoogleResponse {
  results?: PlacesResult[];
  status: string;
  error_message?: string;
  next_page_token?: string;
}

async function callGoogle(query: string, pageToken?: string): Promise<GoogleResponse> {
  const url = new URL(config.GOOGLE_PLACE_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY);
  if (pageToken) url.searchParams.set('pagetoken', pageToken);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    // Falha de rede/indisponibilidade — erro claro para o frontend, não 500 genérico
    throw new HttpError(502, 'GOOGLE_API_ERROR', 'Google Maps indisponível (network/5xx)');
  }
  const data = (await res.json().catch(() => ({}))) as GoogleResponse;
  if (!res.ok || data.status === 'ERROR') {
    throw new HttpError(502, 'GOOGLE_API_ERROR', data.error_message || 'Falha na API do Google', data);
  }
  return data;
}

async function fetchAllPages(query: string, limit: number): Promise<PlacesResult[]> {
  let items: PlacesResult[] = [];
  let pageToken: string | undefined;
  // Text Search retorna até 20 por página; cap 3 páginas (60) por busca para MVP.
  for (let page = 0; page < 3 && items.length < limit; page++) {
    const data = await callGoogle(query, pageToken);
    items = items.concat(data.results ?? []);
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
    if (items.length < limit) await new Promise((r) => setTimeout(r, 1500)); // evita rate limit do Google
  }
  return items.slice(0, limit);
}

async function fetchPlaceDetails(placeId: string): Promise<PlacesResult | null> {
  // Detalhes para export quando snapshot expirou: fetch transient, persiste apenas TTL.
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'name,formatted_address,geometry,website,international_phone_number,rating,user_ratings_total');
    url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY);
    const res = await fetch(url.toString());
    const data = await res.json() as { result?: PlacesResult; status?: string };
    return data.result ?? null;
  } catch (e) {
    logger.warn({ err: String(e), placeId }, 'detalhes do place falharam');
    return null;
  }
}

function toDecimal(v: number | undefined | null) {
  return v != null ? new Prisma.Decimal(v) : null;
}

export async function runSearch(userId: string, input: z.infer<typeof SearchSchema>) {
  const { query, city, category, filters, limit } = input;
  const searchQuery = `${category} em ${city}`; // cidade/bairro + categoria

  const places = await fetchAllPages(searchQuery, limit);

  // Filtro do produto: "sem site" (website ausente/vazio) e "tem telefone"
  const filtered = places.filter((p) => {
    const hasWebsite = typeof p.website === 'string' && p.website.trim().length > 0;
    const hasPhone = typeof p.international_phone_number === 'string' && p.international_phone_number.trim().length > 0;
    return (!filters.semSite || !hasWebsite) && (!filters.temTelefone || hasPhone);
  });

  // Registrar a busca (histórico + painel de uso)
  const search = await prisma.search.create({
    data: {
      userId,
      query,
      city,
      category,
      filtersJson: filters as any,
      resultsCount: filtered.length,
    },
  });

  // Salvar leads (idempotência: UNIQUE(user_id, place_id) → ON CONFLICT DO NOTHING)
  let saved = 0;
  for (const p of filtered) {
    const score = await scoreLead({
      websitePresent: typeof p.website === 'string' && p.website.trim().length > 0,
      phonePresent: typeof p.international_phone_number === 'string' && p.international_phone_number.trim().length > 0,
      rating: p.rating ?? null,
      userRatings: p.user_ratings_total ?? null,
      category,
      city,
      name: p.name,
    });

    // update: {} = mantém pontuação inicial; idempotência na re-busca
    const lead = await prisma.lead.upsert({
      where: { userId_placeId: { userId, placeId: p.place_id } },
      create: {
        userId,
        searchId: search.id,
        placeId: p.place_id,
        lat: p.geometry?.location?.lat != null ? new Prisma.Decimal(p.geometry.location.lat) : null,
        lng: p.geometry?.location?.lng != null ? new Prisma.Decimal(p.geometry.location.lng) : null,
        websitePresent: typeof p.website === 'string' && p.website.trim().length > 0,
        phonePresent: typeof p.international_phone_number === 'string' && p.international_phone_number.trim().length > 0,
        rating: toDecimal(p.rating),
        userRatings: p.user_ratings_total ?? null,
        aiScore: score.score,
        aiReason: score.reason,
        suggestedPitch: score.suggestedPitch || null,
        aiModel: score.model ?? null,
        aiPromptVersion: config.AI_PROMPT_VERSION,
      },
      update: {},
    });
    saved++;
    void lead;

    // Snapshot TTL (ToS: máx 30 dias; 0 = modo estrito, sem snapshot)
    if (snapshotEnabled && p.name) {
      const expires = new Date(Date.now() + googleSnapshotTtlDays * 86400000);
      await prisma.leadSnapshot.upsert({
        where: { placeId: p.place_id },
        create: {
          placeId: p.place_id,
          name: p.name,
          address: p.formatted_address ?? null,
          phone: p.international_phone_number ?? null,
          website: p.website ?? null,
          rating: toDecimal(p.rating),
          userRatings: p.user_ratings_total ?? null,
          expiresAt: expires,
        },
        update: {
          name: p.name,
          address: p.formatted_address ?? null,
          phone: p.international_phone_number ?? null,
          website: p.website ?? null,
          rating: toDecimal(p.rating),
          userRatings: p.user_ratings_total ?? null,
          fetchedAt: new Date(),
          expiresAt: expires,
        },
      });
    }
  }

  return { searchId: search.id, resultsCount: filtered.length, saved };
}

/** Listar leads com paginação + filtros (multi-tenant: userId do token). */
export async function listLeads(userId: string, params: { searchId?: string; page: number; pageSize: number; minScore?: number; temTelefone?: boolean }) {
  const where: any = { userId };
  if (params.searchId) where.searchId = params.searchId;
  if (params.minScore != null) where.aiScore = { gte: params.minScore };
  if (params.temTelefone) where.phonePresent = true;

  const [leadRows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { aiScore: 'desc' }, // prioridade da IA
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  // Join manual com snapshots (cache chaveado por place_id, compartilhado entre usuários)
  const snapshots = await prisma.leadSnapshot.findMany({
    where: { placeId: { in: leadRows.map((r) => r.placeId) }, expiresAt: { gt: new Date() } },
  });
  const byPlace = new Map(snapshots.map((s) => [s.placeId, s]));

  return {
    items: leadRows.map((l) => ({ ...l, snapshot: byPlace.get(l.placeId) ?? null })),
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/** Detalhe de um lead (com snapshot, ou fetch transient se expirado). */
export async function getLeadDetail(userId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } }); // multi-tenant
  if (!lead) throw new HttpError(404, 'LEAD_NOT_FOUND', 'Lead não encontrado');
  const snapshot = await prisma.leadSnapshot.findUnique({ where: { placeId: lead.placeId } });
  return { ...lead, snapshot: snapshot && snapshot.expiresAt > new Date() ? snapshot : null };
}

/** Enriquecer lead com dados display (snapshot expirado → fetch transient do Google). */
export async function enrichLeadDisplay(userId: string, leadId: string) {
  const lead = await getLeadDetail(userId, leadId);
  if (lead.snapshot) return lead;

  const place = await fetchPlaceDetails(lead.placeId);
  if (!place) return lead;
  const expires = new Date(Date.now() + googleSnapshotTtlDays * 86400000);
  await prisma.leadSnapshot.upsert({
    where: { placeId: lead.placeId },
    create: {
      placeId: lead.placeId,
      name: place.name ?? '-',
      address: place.formatted_address ?? null,
      phone: place.international_phone_number ?? null,
      website: place.website ?? null,
      rating: toDecimal(place.rating),
      userRatings: place.user_ratings_total ?? null,
      expiresAt: expires,
    },
    update: {},
  });
  return getLeadDetail(userId, leadId);
}
