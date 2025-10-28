import { useSysMLViewpoints } from '../../hooks/useSysMLApi';
import { useViewpoint } from '../../lib/ViewpointContext';

export default function ViewpointSelector() {
  const { data: viewpoints, isLoading } = useSysMLViewpoints();
  const { selectedViewpoint, setViewpoint } = useViewpoint();

  if (isLoading) {
    return <div style={styles.container}>Loading viewpoints...</div>;
  }

  return (
    <div style={styles.container}>
      <label style={styles.label}>Viewpoint:</label>
      <select
        style={styles.select}
        value={selectedViewpoint?.id || ''}
        onChange={(e) => {
          const vp = viewpoints?.find((v) => v.id === e.target.value);
          setViewpoint(vp || null);
        }}
      >
        <option value="">All Elements</option>
        {viewpoints?.map((vp) => (
          <option key={vp.id} value={vp.id}>
            {vp.name}
          </option>
        ))}
      </select>
      {selectedViewpoint && (
        <div style={styles.description}>{selectedViewpoint.description}</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f9f9f9',
  },
  label: {
    fontWeight: 600,
    marginRight: '8px',
    fontSize: '14px',
  },
  select: {
    padding: '6px 12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  description: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
  },
};
