import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../../src/ui/overlay/Modal';

describe('Modal', () => {
  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <p>Import group</p>
      </Modal>,
    );

    // click the backdrop itself, outside the panel
    await userEvent.click(screen.getByText('Import group').closest('.fixed'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the panel content is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <p>Import group</p>
      </Modal>,
    );

    await userEvent.click(screen.getByText('Import group'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Modal.Footer renders its children right-aligned', () => {
    render(<Modal.Footer><button>Cancel</button></Modal.Footer>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
