import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { api } from '../api';

type Tab = 'overview' | 'scratch';

export default function AdminScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <>
      <Header title="ADMIN — JEUX" />
      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>VUE D'ENSEMBLE</button>
        <button className={tab === 'scratch' ? 'active' : ''} onClick={() => setTab('scratch')}>SCRATCH</button>
      </div>
      {tab === 'overview' ? <OverviewTab /> : <ScratchTab />}
    </>
  );
}

function OverviewTab() {
  const [rev, setRev] = useState<number | null>(null);
  useEffect(() => {
    api.adminOverview().then((r) => setRev(r.scratch_revenue_today)).catch(() => setRev(0));
  }, []);
  return (
    <div className="kpi">
      <div className="l">REVENUS SCRATCH AUJOURD'HUI</div>
      <div className="v">{(rev ?? 0).toLocaleString('fr-FR')} CDF</div>
    </div>
  );
}

function ScratchTab() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.adminTickets>>['rows']>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.adminTickets(page).then((r) => { setRows(r.rows); setTotal(r.total); }).catch(() => {});
  }, [page]);

  return (
    <>
      <table className="admin">
        <thead>
          <tr>
            <th>Date</th>
            <th>Téléphone</th>
            <th>Mise</th>
            <th>Gain</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Aucun ticket.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString('fr-FR')}</td>
              <td>{r.phone ?? '—'}</td>
              <td>{r.bet_amount_cdf.toLocaleString('fr-FR')}</td>
              <td>{r.win_amount_cdf > 0 ? r.win_amount_cdf.toLocaleString('fr-FR') : '—'}</td>
              <td className={`status-${r.status}`}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <button className="chip" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Préc.</button>
        <span className="muted" style={{ padding: 0 }}>Page {page} • {total} tickets</span>
        <button className="chip" onClick={() => setPage((p) => p + 1)} disabled={rows.length < 20}>Suiv. →</button>
      </div>
    </>
  );
}
