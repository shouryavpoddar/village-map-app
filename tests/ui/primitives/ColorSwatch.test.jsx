import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ColorSwatch from '../../../src/ui/primitives/ColorSwatch';

describe('ColorSwatch', () => {
  it('is a native color input carrying the given value', () => {
    render(<ColorSwatch value="#a6402c" onChange={vi.fn()} aria-label="Highlight color" />);
    const input = screen.getByLabelText('Highlight color');
    expect(input).toHaveAttribute('type', 'color');
    expect(input).toHaveValue('#a6402c');
  });

  it('sizes up from sm to md', () => {
    const { rerender } = render(<ColorSwatch size="sm" aria-label="c" value="#000000" onChange={vi.fn()} />);
    expect(screen.getByLabelText('c')).toHaveClass('w-6', 'h-6');

    rerender(<ColorSwatch size="md" aria-label="c" value="#000000" onChange={vi.fn()} />);
    expect(screen.getByLabelText('c')).toHaveClass('w-8', 'h-8');
  });
});
