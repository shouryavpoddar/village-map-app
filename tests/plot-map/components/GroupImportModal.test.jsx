import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupImportModal from '../../../src/plot-map/components/GroupImportModal';

describe('GroupImportModal', () => {
  it('shows the match summary and the unmatched numbers', () => {
    render(
      <GroupImportModal
        fileName="plots.csv"
        matchedCount={8}
        unmatchedNumbers={['101', '202']}
        totalCount={10}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('plots.csv')).toBeInTheDocument();
    expect(screen.getByText(/Matched/)).toHaveTextContent('Matched 8 of 10 plot numbers to existing plots.');
    expect(screen.getByText('101, 202')).toBeInTheDocument();
  });

  it('disables "Create group" until a name is entered', async () => {
    render(
      <GroupImportModal
        fileName="plots.csv"
        matchedCount={8}
        unmatchedNumbers={[]}
        totalCount={8}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const createButton = screen.getByRole('button', { name: 'Create group' });
    expect(createButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('e.g. Irrigated Zone'), 'Irrigated Zone');
    expect(createButton).toBeEnabled();
  });

  it('confirms with the trimmed name and chosen color', async () => {
    const onConfirm = vi.fn();
    render(
      <GroupImportModal
        fileName="plots.csv"
        matchedCount={3}
        unmatchedNumbers={[]}
        totalCount={3}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText('e.g. Irrigated Zone'), '  Dry Zone  ');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(onConfirm).toHaveBeenCalledWith('Dry Zone', '#4a90d9');
  });

  it('cancels via the Cancel button and via the backdrop', async () => {
    const onCancel = vi.fn();
    render(
      <GroupImportModal
        fileName="plots.csv"
        matchedCount={0}
        unmatchedNumbers={[]}
        totalCount={0}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has nothing to tag when zero rows matched', () => {
    render(
      <GroupImportModal
        fileName="plots.csv"
        matchedCount={0}
        unmatchedNumbers={['1', '2']}
        totalCount={2}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nothing to tag/)).toBeInTheDocument();
  });
});
