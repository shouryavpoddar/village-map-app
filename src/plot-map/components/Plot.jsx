import { memo } from 'react';
import { PLOT_CLASSES } from '../helpers/constants';

// A single parcel polygon. Deliberately dumb - no event handlers of its own,
// since selection/drag/click are all handled by one pointerdown/pointerup
// listener on the map container in usePlotMapEngine.js (reading
// e.target.dataset.id), which still works against React-rendered elements
// exactly as it did against manually created DOM nodes. Memoized so that
// e.g. renaming one plot's label doesn't re-render the other few thousand.
function Plot({ plot, fill, selected }) {
  return (
    <polygon
      points={plot.points.map((pt) => pt.join(',')).join(' ')}
      className={PLOT_CLASSES}
      style={fill ? { fill } : undefined}
      data-id={plot.id}
      data-selected={selected}
    />
  );
}

export default memo(Plot);
