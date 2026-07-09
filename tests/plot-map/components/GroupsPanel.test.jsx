import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupsPanel from '../../../src/plot-map/components/GroupsPanel';

const groupList = [
  { name: 'Irrigated Zone', color: '#4a90d9', count: 12 },
  { name: 'Dry Zone', color: '#a6402c', count: 5 },
];

describe('GroupsPanel', () => {
  it('shows the empty-state hint when there are no groups yet', () => {
    render(
      <GroupsPanel
        groupList={[]}
        visibleGroups={new Set()}
        onToggleGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onImportFile={vi.fn()}
      />,
    );
    expect(screen.getByText(/Import a CSV or Excel file/)).toBeInTheDocument();
  });

  it('lists each group with its count and forwards toggle/remove clicks', async () => {
    const onToggleGroup = vi.fn();
    const onRemoveGroup = vi.fn();
    render(
      <GroupsPanel
        groupList={groupList}
        visibleGroups={new Set(['Irrigated Zone'])}
        onToggleGroup={onToggleGroup}
        onRemoveGroup={onRemoveGroup}
        onImportFile={vi.fn()}
      />,
    );

    expect(screen.getByText('Irrigated Zone')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Irrigated Zone/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: /Dry Zone/ })).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(screen.getByRole('switch', { name: /Dry Zone/ }));
    expect(onToggleGroup).toHaveBeenCalledWith('Dry Zone');

    await userEvent.click(screen.getByTitle('Remove group "Irrigated Zone"'));
    expect(onRemoveGroup).toHaveBeenCalledWith('Irrigated Zone');
  });

  it('forwards the picked file to onImportFile', async () => {
    const onImportFile = vi.fn();
    render(
      <GroupsPanel
        groupList={[]}
        visibleGroups={new Set()}
        onToggleGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onImportFile={onImportFile}
      />,
    );

    const file = new File(['101,102'], 'plots.csv', { type: 'text/csv' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    expect(onImportFile).toHaveBeenCalledWith(file);
  });
});
