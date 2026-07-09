import { useEffect, useState } from 'react';

export function useSearch({ plotsRef, selectPlot }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setMatches([]); return; }
    const found = plotsRef.current.filter(p =>
      String(p.id).includes(q) || p.label.toLowerCase().includes(q)
    ).slice(0, 8);
    setMatches(found);
  }, [query, plotsRef]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && matches.length) {
      selectPlot(matches[0]);
      setMatches([]);
    }
  };

  const handlePickMatch = (plot) => {
    selectPlot(plot);
    setMatches([]);
    setQuery(plot.label);
  };

  return { query, setQuery, matches, handleSearchKeyDown, handlePickMatch };
}
