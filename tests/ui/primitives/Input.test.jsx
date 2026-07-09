import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from '../../../src/ui/primitives/Input';

describe('Input', () => {
  it('is a controlled text field that reports each keystroke', async () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} placeholder="Find a plot" />);

    await userEvent.type(screen.getByPlaceholderText('Find a plot'), 'abc');

    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('switches background tone between raised and inset', () => {
    const { rerender } = render(<Input tone="raised" value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveClass('bg-paper-raised');

    rerender(<Input tone="inset" value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveClass('bg-paper');
  });
});
