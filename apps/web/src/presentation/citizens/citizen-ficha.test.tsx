import { render, screen } from '@testing-library/react';
import type { CitizenProfile } from '@/contracts/citizens';
import { CitizenFicha } from './citizen-ficha';

vi.mock('@/features/citizens/actions', () => ({
  mergeCitizensAction: vi.fn(),
  registerCitizenAction: vi.fn(),
  searchCitizensAction: vi.fn(),
  updateCitizenProfileAction: vi.fn(),
}));

const profile: CitizenProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Ana',
  documentId: null,
  addressLine: null,
  neighborhood: null,
  email: null,
  tags: [],
  observations: null,
  partyKind: 'person',
  latitude: -42.1,
  longitude: -71.5,
  registrationStatus: 'unregistered',
  phones: ['5492944000001'],
  mergedIntoId: null,
  whatsappPushName: 'Ana WA',
};

const timeline = {
  messages: [{ id: 'm1', at: '2026-11-08T12:00:00.000Z', direction: 'inbound', body: 'hola' }],
  events: [],
  animals: [{ id: 'a1', at: '2026-11-08T11:00:00.000Z', name: 'Lola', species: 'dog', municipalId: 'EP-1' }],
};

describe('CitizenFicha', () => {
  it('lists the missing DNI and shows the message and the animal', () => {
    render(<CitizenFicha profile={profile} timeline={timeline} canMutate />);
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' && (element.textContent ?? '').replace(/\s+/g, ' ').includes('Faltan datos para registrar: DNI'),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nombre,/)).not.toBeInTheDocument();
    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.getByText(/Lola/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar ficha' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Domicilio / mascota' })).toHaveAttribute('href', expect.stringContaining('mlat=-42.1'));
  });

  it('hides save, register, and merge for support', () => {
    render(<CitizenFicha profile={profile} timeline={timeline} canMutate={false} />);
    expect(screen.queryByRole('button', { name: 'Guardar ficha' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unificar en esta ficha' })).not.toBeInTheDocument();
    expect(screen.getByText('hola')).toBeInTheDocument();
  });
});
