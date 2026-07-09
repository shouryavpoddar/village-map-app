import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconButton from '../../../src/ui/primitives/IconButton';

describe('IconButton', () => {
  it('calls onClick with its glyph rendered', async () => {
    const onClick = vi.fn();
    render(<IconButton title="Remove group &quot;Irrigated&quot;" onClick={onClick}>×</IconButton>);

    const button = screen.getByTitle('Remove group "Irrigated"');
    expect(button).toHaveTextContent('×');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
