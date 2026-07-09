import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '../../../src/ui/display/Badge';

describe('Badge', () => {
  it('renders a tag with an optional color dot', () => {
    const { container } = render(<Badge variant="tag" dotColor="#4a90d9">Irrigated Zone</Badge>);
    expect(screen.getByText('Irrigated Zone')).toBeInTheDocument();
    expect(container.querySelector('span[style]')).toHaveStyle({ background: '#4a90d9' });
  });

  it('renders the rotated stamp variant with no dot', () => {
    render(<Badge variant="stamp">Surveyed</Badge>);
    expect(screen.getByText('Surveyed')).toHaveClass('border-stamp');
  });
});
