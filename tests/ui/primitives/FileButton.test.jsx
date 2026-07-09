import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileButton from '../../../src/ui/primitives/FileButton';

describe('FileButton', () => {
  it('reports the picked file and resets the input so re-picking the same file still fires', async () => {
    const onFileSelect = vi.fn();
    render(
      <FileButton accept=".csv,.xlsx,.xls" onFileSelect={onFileSelect}>Import file</FileButton>,
    );

    const file = new File(['1,2,3'], 'plots.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');

    await userEvent.upload(input, file);

    expect(onFileSelect).toHaveBeenCalledTimes(1);
    expect(onFileSelect).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });

  it('collects every file when multiple is set', async () => {
    const onFileSelect = vi.fn();
    render(<FileButton multiple onFileSelect={onFileSelect}>Import files</FileButton>);

    const files = [
      new File(['a'], 'a.csv', { type: 'text/csv' }),
      new File(['b'], 'b.csv', { type: 'text/csv' }),
    ];
    const input = document.querySelector('input[type="file"]');

    await userEvent.upload(input, files);

    expect(onFileSelect).toHaveBeenCalledWith(files);
  });

  it('looks like a Button — same variant class on the label', () => {
    render(<FileButton variant="raised">Import file</FileButton>);
    expect(screen.getByText('Import file').closest('label')).toHaveClass('bg-paper-raised');
  });
});
