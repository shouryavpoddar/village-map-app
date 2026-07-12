import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewGroupModal from '../../../src/plot-map/components/NewGroupModal';

describe('NewGroupModal', () => {
  it('disables "Create group" until a name is entered', async () => {
    render(<NewGroupModal onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const createButton = screen.getByRole('button', { name: 'Create group' });
    expect(createButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('e.g. Irrigated Zone'), 'Irrigated Zone');
    expect(createButton).toBeEnabled();
  });

  it('confirms with the trimmed name and chosen color', async () => {
    const onConfirm = vi.fn();
    render(<NewGroupModal onConfirm={onConfirm} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('e.g. Irrigated Zone'), '  Dry Zone  ');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(onConfirm).toHaveBeenCalledWith('Dry Zone', '#4a90d9');
  });

  it('confirms on Enter, but cancels on Escape', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<NewGroupModal onConfirm={onConfirm} onCancel={onCancel} />);

    const input = screen.getByPlaceholderText('e.g. Irrigated Zone');
    await userEvent.type(input, 'Dry Zone{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('Dry Zone', '#4a90d9');

    await userEvent.type(input, '{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not confirm on Enter while the name is blank', async () => {
    const onConfirm = vi.fn();
    render(<NewGroupModal onConfirm={onConfirm} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('e.g. Irrigated Zone'), '{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels via the Cancel button', async () => {
    const onCancel = vi.fn();
    render(<NewGroupModal onConfirm={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
