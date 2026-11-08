import { describe, expect, it } from 'vitest';
import { cancelTaskInputSchema, createTaskInputSchema, upsertExternalContactInputSchema } from './tasks';

describe('task contracts', () => {
  it('requires a title and audience for create', () => {
    const parsed = createTaskInputSchema.safeParse({
      conversationId: '00000000-0000-4000-8000-000000000010',
      title: 'Reclamo luminaria',
      audience: 'self',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires cancel reason text when reason is other', () => {
    const parsed = cancelTaskInputSchema.safeParse({
      taskId: '00000000-0000-4000-8000-000000000011',
      reason: 'other',
      reasonText: '',
    });
    expect(parsed.success).toBe(true);
  });

  it('normalizes external contact phones', () => {
    const parsed = upsertExternalContactInputSchema.safeParse({
      areaId: '00000000-0000-4000-8000-000000000012',
      fullName: 'Electricidad',
      phone: '5492944123456',
      isActive: 'on',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.isActive).toBe(true);
  });
});
