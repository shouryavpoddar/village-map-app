import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Switch from '../../../src/ui/primitives/Switch';

describe('Switch', () => {
  it('exposes its state via role=switch and aria-checked', () => {
    render(<Switch checked label="Toggle Irrigated Zone highlight" onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Toggle Irrigated Zone highlight' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with the inverted value, not the current one', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} label="toggle" onChange={onChange} />);

    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
