import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DetailRow from '../../../src/ui/display/DetailRow';

describe('DetailRow', () => {
  it('auto-styles a plain `value`', () => {
    render(<DetailRow label="Area" value="12.3 sq. units" />);
    expect(screen.getByText('Area')).toBeInTheDocument();
    expect(screen.getByText('12.3 sq. units')).toHaveClass('text-ink', 'font-medium');
  });

  it('renders custom `children` instead of a value when both differ', () => {
    render(
      <DetailRow label="Color">
        <span>#a6402c</span>
      </DetailRow>,
    );
    expect(screen.getByText('#a6402c')).toBeInTheDocument();
  });

  it('drops the dashed divider when divider=false', () => {
    render(<DetailRow label="Groups" divider={false}>content</DetailRow>);
    expect(screen.getByText('Groups').parentElement).not.toHaveClass('border-b');
  });
});
