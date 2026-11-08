import type { CitizenProfile, CitizenSearchHit, CitizenTimeline, PartyKind } from '@/contracts/citizens';
import { RepositoryError, type DbClient } from './errors';

function partyKind(value: string | null | undefined): PartyKind {
  return value === 'organization' ? 'organization' : 'person';
}

// Search - the database returns at most 20 rows for this organization.
export async function searchCitizens(client: DbClient, query: string): Promise<CitizenSearchHit[]> {
  const { data, error } = await client.rpc('search_citizens', { p_query: query });
  if (error) throw new RepositoryError('citizens.search_failed', error.message);
  return (data ?? []).map((row) => ({
    id: row.result_id,
    fullName: row.result_full_name,
    documentId: row.result_document_id,
    phone: row.result_phone,
    registrationStatus: row.result_registration_status,
    partyKind: row.result_party_kind,
    pushName: row.result_push_name,
  }));
}

// Profile - one citizen in the caller's organization, including a merged row so the page can redirect.
export async function getCitizenProfile(client: DbClient, id: string): Promise<CitizenProfile | null> {
  const { data, error } = await client
    .from('citizens')
    .select(
      'id, full_name, document_id, address_line, neighborhood, email, tags, observations, party_kind, latitude, longitude, registration_status, merged_into_id, whatsapp_push_name',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new RepositoryError('citizens.read_failed', error.message);
  if (!data) return null;

  const phones = await client
    .from('citizen_phones')
    .select('phone_normalized')
    .eq('citizen_id', id)
    .order('phone_normalized');
  if (phones.error) throw new RepositoryError('citizens.phones_failed', phones.error.message);

  return {
    id: data.id,
    fullName: data.full_name,
    documentId: data.document_id,
    addressLine: data.address_line,
    neighborhood: data.neighborhood,
    email: data.email,
    tags: data.tags ?? [],
    observations: data.observations,
    partyKind: partyKind(data.party_kind),
    latitude: data.latitude,
    longitude: data.longitude,
    registrationStatus: data.registration_status ?? 'unregistered',
    phones: (phones.data ?? []).map((row) => row.phone_normalized),
    mergedIntoId: data.merged_into_id,
    whatsappPushName: data.whatsapp_push_name ?? null,
  };
}

// Timeline - messages, events, and animals already stored. Notes and tasks are not queried.
export async function getCitizenTimeline(client: DbClient, citizenId: string): Promise<CitizenTimeline> {
  const conversations = await client.from('conversations').select('id').eq('citizen_id', citizenId);
  if (conversations.error) throw new RepositoryError('citizens.conversations_failed', conversations.error.message);
  const conversationIds = (conversations.data ?? []).map((row) => row.id);

  const messages =
    conversationIds.length === 0
      ? { data: [], error: null }
      : await client
          .from('messages')
          .select('id, direction, body, created_at')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(50);
  if (messages.error) throw new RepositoryError('citizens.messages_failed', messages.error.message);

  const events =
    conversationIds.length === 0
      ? { data: [], error: null }
      : await client
          .from('conversation_events')
          .select('id, event_type, note, created_at')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(50);
  if (events.error) throw new RepositoryError('citizens.events_failed', events.error.message);

  const animals = await client
    .from('animals')
    .select('id, name, species, municipal_id, created_at')
    .eq('citizen_id', citizenId)
    .order('created_at', { ascending: false });
  if (animals.error) throw new RepositoryError('citizens.animals_failed', animals.error.message);

  return {
    messages: (messages.data ?? []).map((row) => ({
      id: row.id,
      at: row.created_at ?? '',
      direction: row.direction,
      body: row.body,
    })),
    events: (events.data ?? []).map((row) => ({
      id: row.id,
      at: row.created_at,
      eventType: row.event_type,
      note: row.note,
    })),
    animals: (animals.data ?? []).map((row) => ({
      id: row.id,
      at: row.created_at ?? '',
      name: row.name,
      species: row.species,
      municipalId: row.municipal_id,
    })),
  };
}
