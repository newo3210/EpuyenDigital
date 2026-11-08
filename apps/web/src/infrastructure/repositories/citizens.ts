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

// Timeline - org-wide definer read. Inbox message policies stay area-scoped. Notes and tasks come from the same RPC.
export async function getCitizenTimeline(client: DbClient, citizenId: string): Promise<CitizenTimeline> {
  const { data, error } = await client.rpc('list_citizen_timeline', { p_id: citizenId });
  if (error) throw new RepositoryError('citizens.timeline_failed', error.message);

  const timeline: CitizenTimeline = { messages: [], events: [], animals: [], notes: [], tasks: [] };
  for (const row of data ?? []) {
    const at = row.result_at ?? '';
    if (row.result_kind === 'message') {
      timeline.messages.push({
        id: row.result_id,
        at,
        direction: row.result_label ?? '',
        body: row.result_detail,
      });
    } else if (row.result_kind === 'event') {
      timeline.events.push({
        id: row.result_id,
        at,
        eventType: row.result_label ?? '',
        note: row.result_detail,
      });
    } else if (row.result_kind === 'animal') {
      const [species, municipalId] = (row.result_detail ?? '').split(' · ');
      timeline.animals.push({
        id: row.result_id,
        at,
        name: row.result_label ?? '',
        species: species ?? '',
        municipalId: municipalId ?? '',
      });
    } else if (row.result_kind === 'note') {
      timeline.notes.push({
        id: row.result_id,
        at,
        body: row.result_detail,
        kind: row.result_label,
      });
    } else if (row.result_kind === 'task') {
      timeline.tasks.push({
        id: row.result_id,
        at,
        title: row.result_label,
        status: row.result_detail,
      });
    }
  }
  return timeline;
}
