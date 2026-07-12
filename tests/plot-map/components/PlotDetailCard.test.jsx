import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlotDetailCard from '../../../src/plot-map/components/PlotDetailCard';

const plot = {
  id: 42,
  label: 'North Field',
  points: [[0, 0], [10, 0], [10, 10]],
  area: 123.456,
  centroid: [5, 5],
  bbox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  color: '#a6402c',
  groups: [{ name: 'Irrigated Zone', color: '#4a90d9' }],
};

describe('PlotDetailCard', () => {
  it('renders the plot\'s stats', () => {
    render(<PlotDetailCard plot={plot} onRename={vi.fn()} onDelete={vi.fn()} onColorChange={vi.fn()} />);

    expect(screen.getByText('North Field')).toBeInTheDocument();
    expect(screen.getByText('PLOT ID · 42')).toBeInTheDocument();
    expect(screen.getByText('123.5 sq. units')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // vertices
    expect(screen.getByText('5.0, 5.0')).toBeInTheDocument();
    expect(screen.getByText('10 × 10')).toBeInTheDocument();
    expect(screen.getByText('Irrigated Zone')).toBeInTheDocument();
  });

  it('shows "Unlabeled" in italics when the plot has no label', () => {
    render(<PlotDetailCard plot={{ ...plot, label: '' }} onRename={vi.fn()} onDelete={vi.fn()} onColorChange={vi.fn()} />);
    expect(screen.getByText('Unlabeled')).toBeInTheDocument();
  });

  it('commits a rename on Enter, but not on Escape', async () => {
    const onRename = vi.fn();
    render(<PlotDetailCard plot={plot} onRename={onRename} onDelete={vi.fn()} onColorChange={vi.fn()} />);

    await userEvent.click(screen.getByText('North Field'));
    const input = screen.getByDisplayValue('North Field');
    await userEvent.clear(input);
    await userEvent.type(input, 'South Field{Enter}');

    expect(onRename).toHaveBeenCalledWith(42, 'South Field');
  });

  it('changes the plot color', async () => {
    const onColorChange = vi.fn();
    render(<PlotDetailCard plot={plot} onRename={vi.fn()} onDelete={vi.fn()} onColorChange={onColorChange} />);

    // userEvent doesn't drive <input type=color> the way a real color
    // picker would, so fire the change React actually listens for.
    const colorInput = document.querySelector('input[type="color"]');
    fireEvent.change(colorInput, { target: { value: '#00ff00' } });

    expect(onColorChange).toHaveBeenCalledWith(42, '#00ff00');
  });

  describe('delete', () => {
    beforeEach(() => {
      vi.spyOn(window, 'confirm');
    });
    afterEach(() => {
      window.confirm.mockRestore();
    });

    it('deletes the plot when the confirmation is accepted', async () => {
      window.confirm.mockReturnValue(true);
      const onDelete = vi.fn();
      render(<PlotDetailCard plot={plot} onRename={vi.fn()} onDelete={onDelete} onColorChange={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: 'Delete plot' }));

      expect(window.confirm).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalledWith(42);
    });

    it('leaves the plot alone when the confirmation is declined', async () => {
      window.confirm.mockReturnValue(false);
      const onDelete = vi.fn();
      render(<PlotDetailCard plot={plot} onRename={vi.fn()} onDelete={onDelete} onColorChange={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: 'Delete plot' }));

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('group membership', () => {
    const groupList = [
      { name: 'Irrigated Zone', color: '#4a90d9', count: 1 },
      { name: 'Dry Zone', color: '#a6402c', count: 0 },
    ];

    it('only offers groups the plot is not already a member of', () => {
      render(
        <PlotDetailCard
          plot={plot}
          groupList={groupList}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onColorChange={vi.fn()}
          onAddToGroup={vi.fn()}
          onRemoveFromGroup={vi.fn()}
        />,
      );

      const options = screen.getByRole('combobox').querySelectorAll('option');
      expect(Array.from(options).map((o) => o.textContent)).toEqual(['Choose…', 'Dry Zone']);
    });

    it('calls onAddToGroup when a group is picked from the dropdown', async () => {
      const onAddToGroup = vi.fn();
      render(
        <PlotDetailCard
          plot={plot}
          groupList={groupList}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onColorChange={vi.fn()}
          onAddToGroup={onAddToGroup}
          onRemoveFromGroup={vi.fn()}
        />,
      );

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Dry Zone');
      expect(onAddToGroup).toHaveBeenCalledWith('Dry Zone');
    });

    it('does not show the "Add to group" picker once the plot belongs to every group', () => {
      render(
        <PlotDetailCard
          plot={plot}
          groupList={[{ name: 'Irrigated Zone', color: '#4a90d9', count: 1 }]}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onColorChange={vi.fn()}
          onAddToGroup={vi.fn()}
          onRemoveFromGroup={vi.fn()}
        />,
      );

      expect(screen.queryByText('Add to group')).not.toBeInTheDocument();
    });

    it('calls onRemoveFromGroup when a group badge\'s "x" is clicked', async () => {
      const onRemoveFromGroup = vi.fn();
      render(
        <PlotDetailCard
          plot={plot}
          groupList={groupList}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onColorChange={vi.fn()}
          onAddToGroup={vi.fn()}
          onRemoveFromGroup={onRemoveFromGroup}
        />,
      );

      await userEvent.click(screen.getByTitle('Remove from "Irrigated Zone"'));
      expect(onRemoveFromGroup).toHaveBeenCalledWith('Irrigated Zone');
    });
  });
});
