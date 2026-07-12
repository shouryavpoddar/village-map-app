import { Eyebrow, Muted, FileButton, Button, Switch, IconButton } from '../../ui';

export default function GroupsPanel({ groupList, visibleGroups, onToggleGroup, onRemoveGroup, onImportFile, onNewGroup }) {
  return (
    <div className="px-5 py-4 border-b border-line-faint">
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Groups</Eyebrow>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onNewGroup}>New group</Button>
          <FileButton size="sm" accept=".csv,.xlsx,.xls" onFileSelect={onImportFile}>Import file</FileButton>
        </div>
      </div>
      {groupList.length === 0 ? (
        <Muted className="m-0">
          Import a CSV or Excel file of plot numbers, or start a new group and add plots to it by hand.
        </Muted>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-[6px]">
          {groupList.map((g) => (
            <li key={g.name} className="flex items-center gap-2 text-[12.5px]">
              <span className="w-3 h-3 border border-line-faint flex-none" style={{ background: g.color }} />
              <span className="flex-1 truncate text-ink">{g.name}</span>
              <span className="text-ink-soft text-[11px]">{g.count}</span>
              <Switch checked={visibleGroups.has(g.name)} onChange={() => onToggleGroup(g.name)} label={`Toggle ${g.name} highlight`} />
              <IconButton title={`Remove group "${g.name}"`} onClick={() => onRemoveGroup(g.name)}>×</IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
