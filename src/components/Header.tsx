import { useNavigate } from 'react-router-dom';

export default function Header({ title, balance, back = false }: { title: string; balance?: number; back?: boolean }) {
  const nav = useNavigate();
  return (
    <div className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {back && (
          <button className="back" onClick={() => nav(-1)} aria-label="Retour">←</button>
        )}
        <h1>{title}</h1>
      </div>
      {balance != null && <div className="balance-pill">{balance.toLocaleString('fr-FR')} CDF</div>}
    </div>
  );
}
