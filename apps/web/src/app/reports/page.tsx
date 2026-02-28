export default function ReportsPage() {
  return (
    <div>
      <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>Living Reports</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}>
        Data-driven investigations into where money flows, who holds power, and what outcomes result.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        <a href="/reports/youth-justice" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            background: '#fff', border: '2px solid #dc2626', borderRadius: '12px',
            padding: '24px', transition: 'transform 0.2s',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>
              FLAGSHIP
            </div>
            <h2 style={{ fontSize: '20px', margin: '0 0 8px' }}>QLD Youth Justice</h2>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              $343M/year on detention. $1.3M per child. 73% reoffend.
              Follow the money from taxpayer to outcome.
            </p>
          </div>
        </a>

        <a href="/reports/money-flow" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            background: '#fff', border: '2px solid #2563eb', borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#2563eb', marginBottom: '8px' }}>
              LIVE
            </div>
            <h2 style={{ fontSize: '20px', margin: '0 0 8px' }}>Follow the Dollar</h2>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              Trace funding flows from taxpayer to outcome across all domains.
              Interactive flow diagrams for every tracked program.
            </p>
          </div>
        </a>

        <a href="/reports/access-gap" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            background: '#fff', border: '2px solid #d97706', borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#d97706', marginBottom: '8px' }}>
              LIVE
            </div>
            <h2 style={{ fontSize: '20px', margin: '0 0 8px' }}>The Access Gap</h2>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              Small orgs spend 40% on admin. Large orgs spend 15%.
              The structural barriers to community funding.
            </p>
          </div>
        </a>

        <a href="/reports/power-dynamics" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            background: '#fff', border: '2px solid #7c3aed', borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>
              LIVE
            </div>
            <h2 style={{ fontSize: '20px', margin: '0 0 8px' }}>Power Dynamics</h2>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              Who controls Australia&apos;s philanthropy? HHI concentration,
              Gini inequality, and funding distribution analysis.
            </p>
          </div>
        </a>
      </div>
    </div>
  );
}
