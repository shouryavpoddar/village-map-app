import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalibrationPanel from '../../../src/plot-map/components/CalibrationPanel';

describe('CalibrationPanel', () => {
  it('displays the formatted x/y/scale readout', () => {
    render(
      <CalibrationPanel
        calibDisplay={{ x: 1.005, y: -2.1, scale: 0.99999 }}
        onReset={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText('1.00')).toBeInTheDocument();
    expect(screen.getByText('-2.10')).toBeInTheDocument();
    expect(screen.getByText('1.0000')).toBeInTheDocument();
  });

  it('wires up Reset and Copy rect', async () => {
    const onReset = vi.fn();
    const onCopy = vi.fn();
    render(
      <CalibrationPanel calibDisplay={{ x: 0, y: 0, scale: 1 }} onReset={onReset} onCopy={onCopy} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await userEvent.click(screen.getByRole('button', { name: 'Copy rect' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
