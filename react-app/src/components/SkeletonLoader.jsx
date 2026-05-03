export default function SkeletonLoader() {
  return (
    <div className="file-list-container" style={{ paddingTop: 20 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          animation: `fadeInUp 0.3s ease ${i * 0.05}s both`,
        }}>
          <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ width: `${50 + Math.random() * 30}%`, height: 14 }} />
          </div>
          <div className="skeleton" style={{ width: 80, height: 12 }} />
          <div className="skeleton" style={{ width: 60, height: 12 }} />
        </div>
      ))}
    </div>
  );
}
