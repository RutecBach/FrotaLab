'use client';
import { useEffect, useRef, useState } from 'react';
import { Navigation, X, Square } from 'lucide-react';
import { api } from '../lib/api';
export default function DriverLocation({ route, onClose }: { route: any; onClose: () => void }) {
  const [status, setStatus] = useState('Desativada');
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const watch = useRef<number | undefined>(undefined);
  const last = useRef(0);
  const stop = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = undefined;
    setSharing(false);
    setStatus('Compartilhamento encerrado');
  };
  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );
  function start() {
    setError('');
    if (!navigator.geolocation) {
      setError('Este navegador não disponibiliza geolocalização.');
      return;
    }
    if (!window.isSecureContext) {
      setError('A geolocalização exige HTTPS em acesso remoto.');
      return;
    }
    setStatus('Solicitando permissão…');
    setSharing(true);
    watch.current = navigator.geolocation.watchPosition(
      async (pos) => {
        if (Date.now() - last.current < 5000) return;
        last.current = Date.now();
        try {
          await api('/positions', {
            method: 'POST',
            body: {
              routeId: route.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              recordedAt: new Date(pos.timestamp).toISOString(),
              source: 'device',
            },
          });
          setError('');
          setStatus(`Posição enviada às ${new Date().toLocaleTimeString('pt-BR')}`);
        } catch (e) {
          setError((e as Error).message);
        }
      },
      (e) => {
        setError(
          e.code === 1
            ? 'Permissão negada. Autorize a localização nas configurações do navegador.'
            : 'Não foi possível obter sua posição. Verifique o sinal e tente novamente.',
        );
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }
  return (
    <section className="location-banner">
      <div className="icon-box green">
        <Navigation size={22} />
      </div>
      <div>
        <strong>Localização · {route.name}</strong>
        <p>Sua posição será enviada durante esta viagem, enquanto esta página estiver ativa.</p>
        <small>{status}</small>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {sharing ? (
        <button className="button secondary small" onClick={stop}>
          <Square size={15} /> Parar
        </button>
      ) : (
        <button className="button primary small" onClick={start}>
          Compartilhar localização
        </button>
      )}
      <button
        className="icon-button"
        aria-label="Fechar localização"
        onClick={() => {
          stop();
          onClose();
        }}
      >
        <X size={18} />
      </button>
    </section>
  );
}
