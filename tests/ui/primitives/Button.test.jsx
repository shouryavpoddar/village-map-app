import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../../../src/ui/primitives/Button';

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Fit all plots</Button>);

    const button = screen.getByRole('button', { name: 'Fit all plots' });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to type="button" so it never submits a form', () => {
    render(<Button>Reset</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Create group</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('switches its look with variant="toggle" based on the active prop', () => {
    const { rerender } = render(<Button variant="toggle" active={false}>Calibrate map</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-paper-raised');

    rerender(<Button variant="toggle" active>Calibrate map</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-stamp');
  });

  it('merges a caller-supplied className onto the variant classes', () => {
    render(<Button className="absolute right-[22px]">Add plot</Button>);
    expect(screen.getByRole('button')).toHaveClass('absolute', 'right-[22px]', 'border-line');
  });
});
