import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../api';

export default function HomeScreen() {
  const nav = useNavigate();
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    api.me().then((r) => setBalance(r.balance)).catch(() => {});
  }, []);

  return (
    <>
      <Header title="CONGO GAMING" balance={balance} />
      <div className="cards">
        <div className="promo-card" onClick={() => alert('Loto Express — démo')}>
          <h3>LOTO EXPRESS</h3>
          <p>Tirages toutes les 5 minutes. Choisissez vos numéros.</p>
          <span className="cta">JOUER →</span>
        </div>

        {/* Scratch promo (between Loto Express and Dépôt/Retrait per spec) */}
        <div className="promo-card scratch" onClick={() => nav('/scratch')}>
          <div className="sparkle" />
          <h3>SCRATCH CARD</h3>
          <p>Grattez et gagnez instantanément</p>
          <span className="cta">GRATTER MAINTENANT →</span>
        </div>

        <div className="promo-card" onClick={() => alert('Dépôt / Retrait — démo')}>
          <h3>DÉPÔT / RETRAIT</h3>
          <p>Mobile Money — Airtel, Orange, M-Pesa.</p>
          <span className="cta">OUVRIR →</span>
        </div>
      </div>
    </>
  );
}
