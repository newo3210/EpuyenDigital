import Link from 'next/link';
import type { AreaMembership, Role } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.settings.operators;

// Operators table row - profile fields plus email and memberships.
export type OperatorRow = {
  id: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  email: string | null;
  memberships: AreaMembership[];
};

type OperatorsTableProps = {
  operators: OperatorRow[];
  areaNames: Record<string, string>;
};

// Operators table - name, email, role, active flag, areas, edit link.
export function OperatorsTable({ operators, areaNames }: OperatorsTableProps) {
  if (operators.length === 0) {
    return <p className="text-sm text-muted">{copy.listEmpty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-canvas text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">{copy.nameLabel}</th>
            <th className="px-4 py-2 font-medium">{copy.emailLabel}</th>
            <th className="px-4 py-2 font-medium">{copy.roleLabel}</th>
            <th className="px-4 py-2 font-medium">{copy.areasLabel}</th>
            <th className="px-4 py-2 font-medium">{copy.activeLabel}</th>
            <th className="px-4 py-2 font-medium">
              <span className="sr-only">{copy.edit}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {operators.map((operator) => (
            <tr key={operator.id}>
              <td className="px-4 py-3 font-medium">{operator.fullName}</td>
              <td className="px-4 py-3 text-muted">{operator.email ?? '—'}</td>
              <td className="px-4 py-3">{esAR.roles[operator.role]}</td>
              <td className="px-4 py-3 text-muted">
                {operator.memberships.length === 0
                  ? '—'
                  : operator.memberships.map((m) => areaNames[m.areaId] ?? m.areaId).join(', ')}
              </td>
              <td className="px-4 py-3">{operator.isActive ? copy.activeYes : copy.activeNo}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/settings/operators/${operator.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {copy.edit}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
