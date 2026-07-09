import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from '../../../src/ui/display/Card';

describe('Card', () => {
  it('renders its children inside a bordered panel', () => {
    render(<Card>Plot detail</Card>);
    expect(screen.getByText('Plot detail')).toHaveClass('border', 'border-line');
  });

  it('adds the decorative corner-bracket classes only when corners is set', () => {
    const { rerender } = render(<Card>content</Card>);
    expect(screen.getByText('content')).not.toHaveClass('relative');

    rerender(<Card corners>content</Card>);
    expect(screen.getByText('content')).toHaveClass('relative');
  });
});
