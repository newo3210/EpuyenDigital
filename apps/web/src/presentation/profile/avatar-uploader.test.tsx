import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { esAR } from '@/i18n/es-AR';
import { AvatarUploader } from './avatar-uploader';

// Server action mock - only pre-validated files may reach it.
const { uploadAvatarAction } = vi.hoisted(() => ({
  uploadAvatarAction: vi.fn<(state: unknown, formData: FormData) => Promise<Record<string, unknown>>>(async () => ({
    status: 'ok',
    message: 'Foto actualizada.',
  })),
}));
vi.mock('@/features/profile/actions', () => ({ uploadAvatarAction }));

const copy = esAR.profile;

// File factory - content size drives File.size.
const fileOf = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  uploadAvatarAction.mockClear();
});

// Avatar uploader - client pre-check on type/size, then the upload server action.
describe('AvatarUploader', () => {
  it('shows initials when there is no avatar yet', () => {
    render(<AvatarUploader fullName="Ana Pérez" avatarUrl={null} />);

    expect(screen.getByRole('img', { name: 'Ana Pérez' })).toHaveTextContent('AP');
  });

  it('rejects a PDF without uploading', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<AvatarUploader fullName="Ana Pérez" avatarUrl={null} />);

    await user.upload(screen.getByLabelText(copy.avatarLabel), fileOf('cv.pdf', 'application/pdf', 1024));
    await user.click(screen.getByRole('button', { name: copy.uploadAvatar }));

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invalidImage);
    expect(uploadAvatarAction).not.toHaveBeenCalled();
  });

  it('rejects an image over 2 MB without uploading', async () => {
    const user = userEvent.setup();
    render(<AvatarUploader fullName="Ana Pérez" avatarUrl={null} />);

    await user.upload(screen.getByLabelText(copy.avatarLabel), fileOf('big.png', 'image/png', 3 * 1024 * 1024));
    await user.click(screen.getByRole('button', { name: copy.uploadAvatar }));

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invalidImage);
    expect(uploadAvatarAction).not.toHaveBeenCalled();
  });

  it('uploads a valid PNG', async () => {
    const user = userEvent.setup();
    render(<AvatarUploader fullName="Ana Pérez" avatarUrl={null} />);

    await user.upload(screen.getByLabelText(copy.avatarLabel), fileOf('me.png', 'image/png', 500 * 1024));
    await user.click(screen.getByRole('button', { name: copy.uploadAvatar }));

    await waitFor(() => expect(uploadAvatarAction).toHaveBeenCalledTimes(1));
    const sent = uploadAvatarAction.mock.calls[0]?.[1].get('avatar');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('me.png');
    expect(await screen.findByRole('status')).toHaveTextContent(copy.avatarSaved);
  });
});
