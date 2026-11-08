import { describe, expect, it } from 'vitest';
import { parseExternalTaskCommand } from './external-task-commands';

describe('parseExternalTaskCommand', () => {
  it('parses ACEPTO with a public ref', () => {
    expect(parseExternalTaskCommand('acepto T-0012')).toEqual({ kind: 'ACEPTO', ref: 'T-0012' });
  });

  it('parses RECHAZO with a motive', () => {
    expect(parseExternalTaskCommand('RECHAZO T-0003 sin materiales')).toEqual({
      kind: 'RECHAZO',
      ref: 'T-0003',
      detail: 'sin materiales',
    });
  });

  it('returns HELP for free text', () => {
    expect(parseExternalTaskCommand('hola')).toEqual({ kind: 'HELP' });
  });
});
