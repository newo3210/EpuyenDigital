import { readBoolean } from './form-data';

describe('readBoolean (area FormData)', () => {
  it('defaults isActive to true when the field is absent on create', () => {
    const formData = new FormData();
    expect(readBoolean(formData, 'isActive', true)).toBe(true);
  });

  it('honours explicit false', () => {
    const formData = new FormData();
    formData.set('isActive', 'false');
    expect(readBoolean(formData, 'isActive', true)).toBe(false);
  });

  it('honours on/true as checked', () => {
    const on = new FormData();
    on.set('isActive', 'on');
    expect(readBoolean(on, 'isActive')).toBe(true);

    const truthy = new FormData();
    truthy.set('isActive', 'true');
    expect(readBoolean(truthy, 'isActive')).toBe(true);
  });

  it('defaults absent isDefault to false', () => {
    expect(readBoolean(new FormData(), 'isDefault')).toBe(false);
  });
});
