import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from '../../../src/ui/primitives/Select';

describe('Select', () => {
  it('renders an options array as <option> elements and reports the pick', async () => {
    const onChange = vi.fn();
    render(
      <Select
        value="ahu"
        onChange={onChange}
        options={[
          { value: 'ahu', label: 'Ahu' },
          { value: 'seronda', label: 'Seronda' },
        ]}
      />,
    );

    expect(screen.getByRole('option', { name: 'Ahu' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Seronda' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'seronda');
    expect(onChange).toHaveBeenCalled();
  });

  it('falls back to raw <option> children when no options array is given', () => {
    render(
      <Select value="a" onChange={() => {}}>
        <option value="a">A</option>
      </Select>,
    );
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });
});
