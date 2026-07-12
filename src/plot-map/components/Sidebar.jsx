import { useState } from 'react';
import PlotDetailCard from './PlotDetailCard';
import GroupsPanel from './GroupsPanel';
import GroupImportModal from './GroupImportModal';
import NewGroupModal from './NewGroupModal';
import { parsePlotNumbersFromFile } from '../helpers/parsePlotNumbers';
import { Eyebrow, Select, Input } from '../../ui';

export default function Sidebar({ engine, search, towns, townKey, onTownChange, maps, mapKey, onMapChange, loading }) {
  const {
    plotCount, selectedPlot, renameLabel, deletePlot, setPlotColor, saveStatus, plotsRef,
    groupList, visibleGroups, importGroup, toggleGroup, removeGroup,
    createGroup, addPlotToGroup, removePlotFromGroup,
  } = engine;
  const { query, setQuery, matches, handleSearchKeyDown, handlePickMatch } = search;

  const [pendingImport, setPendingImport] = useState(null); // { fileName, matchedIds, matchedCount, totalCount }
  const [importError, setImportError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const handleImportFile = async (file) => {
    setImportError('');
    try {
      const numbers = await parsePlotNumbersFromFile(file);
      const idByLabel = new Map(plotsRef.current.map((p) => [p.label, p.id]));
      const matchedIds = [];
      const unmatchedNumbers = [];
      for (const n of numbers) {
        const id = idByLabel.get(n);
        if (id != null) matchedIds.push(id);
        else unmatchedNumbers.push(n);
      }
      setPendingImport({ fileName: file.name, matchedIds, unmatchedNumbers, totalCount: numbers.length });
    } catch (err) {
      console.error('Failed to parse', file.name, err);
      setImportError(`Couldn't read "${file.name}" - make sure it's a valid .csv/.xlsx/.xls file.`);
    }
  };

  const handleConfirmImport = (name, color) => {
    importGroup(name, color, pendingImport.matchedIds);
    setPendingImport(null);
  };

  const handleConfirmNewGroup = (name, color) => {
    createGroup(name, color);
    setCreatingGroup(false);
  };

  return (
    <div className="flex-none w-[320px] bg-panel border-l border-line flex flex-col h-screen max-[760px]:w-full max-[760px]:h-[46vh] max-[760px]:order-2 max-[760px]:border-l-0 max-[760px]:border-t max-[760px]:border-line">
      <div className="px-5 pt-5 pb-[14px] border-b border-line-faint">
        <Eyebrow className="mb-1">Field Notes</Eyebrow>
        <h2 className="font-serif font-semibold text-xl m-0 mb-[6px] text-ink">Plot Register</h2>
        <div className="text-[11px] text-ink-soft tracking-[0.03em] mb-3">
          {loading ? 'Loading plots…' : `${plotCount.toLocaleString()} plots loaded`}
          {saveStatus === 'saving' && <span className="text-stamp"> · saving…</span>}
          {saveStatus === 'error' && <span className="text-stamp font-semibold"> · save failed, edit not written to disk</span>}
        </div>
        {towns.length > 1 && (
          <Select
            className={maps.length > 1 ? 'mb-2' : undefined}
            value={townKey ?? ''}
            onChange={(e) => onTownChange(e.target.value)}
            options={towns.map((t) => ({ value: t.key, label: t.label }))}
          />
        )}
        {maps.length > 1 && (
          <Select
            value={mapKey ?? ''}
            onChange={(e) => onMapChange(e.target.value)}
            options={maps.map((m) => ({ value: m.key, label: m.label }))}
          />
        )}
      </div>

      <GroupsPanel
        groupList={groupList}
        visibleGroups={visibleGroups}
        onToggleGroup={toggleGroup}
        onRemoveGroup={removeGroup}
        onImportFile={handleImportFile}
        onNewGroup={() => setCreatingGroup(true)}
      />
      {importError && <p className="px-5 py-2 text-[11px] text-stamp border-b border-line-faint">{importError}</p>}

      <div className="px-5 py-4 border-b border-line-faint relative">
        <Input
          type="text"
          placeholder="Find a plot — ID or label…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          autoComplete="off"
        />
        {matches.length > 0 && (
          <div className="absolute left-5 right-5 top-full bg-paper-raised border border-line border-t-0 max-h-[220px] overflow-y-auto z-20">
            {matches.map(p => (
              <div
                key={p.id}
                className="px-[10px] py-2 text-xs cursor-pointer border-b border-line-faint hover:bg-stamp-soft"
                onClick={() => handlePickMatch(p)}
              >
                {p.label || <span className="italic text-ink-soft">Unlabeled</span>} <b className="text-stamp">#{p.id}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-[18px]">
        {selectedPlot ? (
          <PlotDetailCard
            plot={selectedPlot}
            groupList={groupList}
            onRename={renameLabel}
            onDelete={deletePlot}
            onColorChange={setPlotColor}
            onAddToGroup={(groupName) => addPlotToGroup(selectedPlot.id, groupName)}
            onRemoveFromGroup={(groupName) => removePlotFromGroup(selectedPlot.id, groupName)}
          />
        ) : (
          <div className="text-[12.5px] leading-[1.9] text-ink-soft">
            <p><span className="inline-block font-mono bg-paper-raised border border-line px-[6px] mr-1 text-[11px]">drag</span> to pan the sheet</p>
            <p><span className="inline-block font-mono bg-paper-raised border border-line px-[6px] mr-1 text-[11px]">scroll</span> to zoom in or out</p>
            <p><span className="inline-block font-mono bg-paper-raised border border-line px-[6px] mr-1 text-[11px]">click</span> a plot to survey it</p>
            <p className="mt-[18px]">Select any parcel on the map, or search by plot number, to view its area and coordinates here.</p>
          </div>
        )}
      </div>

      <div className="px-5 pt-3 pb-4 border-t border-line-faint text-[10.5px] text-ink-soft tracking-[0.03em]">Coordinates in original survey-sheet units · not geo-referenced</div>

      {pendingImport && (
        <GroupImportModal
          fileName={pendingImport.fileName}
          matchedCount={pendingImport.matchedIds.length}
          unmatchedNumbers={pendingImport.unmatchedNumbers}
          totalCount={pendingImport.totalCount}
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {creatingGroup && (
        <NewGroupModal
          onConfirm={handleConfirmNewGroup}
          onCancel={() => setCreatingGroup(false)}
        />
      )}
    </div>
  );
}
