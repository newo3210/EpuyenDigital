import { render, screen } from '@testing-library/react';
import { Avatar } from './avatar';

// Avatar rendering - photo when a URL exists, initials fallback otherwise; both labelled with the name.
describe('Avatar', () => {
  it('shows initials when there is no photo', () => {
    render(<Avatar fullName="Ana Pérez" src={null} />);

    const avatar = screen.getByRole('img', { name: 'Ana Pérez' });
    expect(avatar).toHaveTextContent('AP');
    expect(avatar.tagName).not.toBe('IMG');
  });

  it('shows the photo when a URL is given', () => {
    render(<Avatar fullName="Ana Pérez" src="http://127.0.0.1:54321/storage/v1/object/public/avatars/a.png" />);

    const avatar = screen.getByRole('img', { name: 'Ana Pérez' });
    expect(avatar.tagName).toBe('IMG');
    expect(avatar).toHaveAttribute('src', 'http://127.0.0.1:54321/storage/v1/object/public/avatars/a.png');
  });
});
