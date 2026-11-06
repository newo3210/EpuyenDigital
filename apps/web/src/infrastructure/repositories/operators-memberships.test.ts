import { createSupabaseMock } from '@/test/supabase-mock';
import { replaceOperatorMemberships } from './operators';
import { RepositoryError } from './errors';

const USER_ID = '00000000-0000-4000-8000-0000000000b1';
const AREA_A = '00000000-0000-4000-8000-000000000010';
const AREA_B = '00000000-0000-4000-8000-000000000011';

describe('replaceOperatorMemberships', () => {
  it('calls replace_area_memberships RPC with snake_case payload (atomic)', async () => {
    const mock = createSupabaseMock();
    mock.queue('rpc:replace_area_memberships', { data: null, error: null });

    await replaceOperatorMemberships(mock.client, USER_ID, [
      { areaId: AREA_A, isLead: true },
      { areaId: AREA_B, isLead: false },
    ]);

    expect(mock.callsFor('rpc:replace_area_memberships')).toEqual([
      {
        method: 'rpc',
        args: [
          {
            p_user_id: USER_ID,
            p_memberships: [
              { area_id: AREA_A, is_lead: true },
              { area_id: AREA_B, is_lead: false },
            ],
          },
        ],
      },
    ]);
  });

  it('fails closed when the RPC errors (no client-side wipe)', async () => {
    const mock = createSupabaseMock();
    mock.queue('rpc:replace_area_memberships', {
      data: null,
      error: { message: 'area_member_org_mismatch' },
    });

    await expect(
      replaceOperatorMemberships(mock.client, USER_ID, [{ areaId: AREA_A, isLead: false }]),
    ).rejects.toBeInstanceOf(RepositoryError);

    // No separate delete/insert against area_members — only the RPC.
    expect(mock.callsFor('area_members')).toEqual([]);
  });
});
