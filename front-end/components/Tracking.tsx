'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Radio } from 'lucide-react';
import { api, when } from '../lib/api';
import 'leaflet/dist/leaflet.css';
export default function Tracking() {
  const [positions, setPositions] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<import('leaflet').Map | null>(null);
  const layer = useRef<import('leaflet').LayerGroup | null>(null);
  useEffect(() => {
    api('/positions')
      .then((d) => setPositions(d.items))
      .catch((e) => setError(e.message));
    api('/vehicles?limit=200').then((d) => setVehicles(d.items));
    const events = new EventSource('/api/positions/stream');
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    events.addEventListener('snapshot', (e) =>
      setPositions(JSON.parse((e as MessageEvent).data).items),
    );
    events.addEventListener('position', (e) => {
      const row = JSON.parse((e as MessageEvent).data);
      setPositions((old) => [row, ...old.filter((p) => p.vehicleId !== row.vehicleId)]);
    });
    events.addEventListener('session-expired', () => {
      events.close();
      window.location.assign('/login');
    });
    const timer = setInterval(() => setTick((v) => v + 1), 10000);
    return () => {
      events.close();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    let live = true;
    import('leaflet').then((L) => {
      if (!live || !node.current || map.current) return;
      const instance = L.map(node.current).setView([-24.8589, -54.3333], 12);
      map.current = instance;
      L.tileLayer(
        process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      )
        .addTo(instance)
        .on('tileerror', () =>
          setError(
            'O mapa externo está indisponível. As coordenadas e os horários continuam na lista.',
          ),
        );
      layer.current = L.layerGroup().addTo(instance);
      setTick((v) => v + 1);
    });
    return () => {
      live = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  useEffect(() => {
    import('leaflet').then((L) => {
      if (!map.current || !layer.current) return;
      layer.current.clearLayers();
      for (const p of positions) {
        const stale = Date.now() - new Date(p.createdAt).getTime() > 60000;
        const vehicle = vehicles.find((v) => v.id === p.vehicleId);
        const popup = document.createElement('div');
        popup.textContent = `${vehicle?.plate || 'Veículo'} · ${p.source === 'demo' ? 'Demonstração' : 'Dispositivo'} · ${when(p.createdAt)}`;
        L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({
            className: 'fleet-marker',
            html: `<span class="${stale ? 'stale' : ''}">${vehicle?.plate || '●'}</span>`,
            iconSize: [78, 28],
            iconAnchor: [39, 14],
          }),
        })
          .addTo(layer.current)
          .bindPopup(popup);
      }
    });
  }, [positions, vehicles, tick]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">VISIBILIDADE DA OPERAÇÃO</span>
          <h1>Rastreamento</h1>
          <p>Posições recebidas dos motoristas, com origem e horário de atualização.</p>
        </div>
        <span className={`connection-chip ${connected ? 'online' : ''}`}>
          <Radio size={15} />
          {connected ? 'Recebendo atualizações' : 'Reconectando…'}
        </span>
      </div>
      {error && <div className="notice-box">{error}</div>}
      <section className="tracking-layout">
        <div className="panel map-panel">
          <div ref={node} className="fleet-map" aria-label="Mapa de posições dos veículos" />
          <div className="map-legend">
            <span>
              <i /> Posição recente
            </span>
            <span>
              <i className="stale" /> Sem atualização há mais de 60 s
            </span>
          </div>
        </div>
        <div className="panel tracking-list">
          <div className="panel-heading">
            <h2>Últimas posições</h2>
            <span className="count-chip">{positions.length}</span>
          </div>
          {positions.map((p) => {
            const v = vehicles.find((x) => x.id === p.vehicleId);
            const stale = Date.now() - new Date(p.createdAt).getTime() > 60000;
            return (
              <button
                className="position-card"
                key={p.vehicleId}
                onClick={() => map.current?.setView([p.latitude, p.longitude], 14)}
              >
                <div>
                  <span className="icon-box green">
                    <Navigation size={19} />
                  </span>
                  <strong>{v?.plate || 'Veículo'}</strong>
                  <span className={`badge ${stale ? 'badge-late' : 'badge-completed'}`}>
                    {stale ? 'Desatualizada' : 'Recente'}
                  </span>
                </div>
                <p>{v?.model}</p>
                <small>
                  {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </small>
                <small>Recebida em {when(p.createdAt)}</small>
                <span className="source-label">
                  {p.source === 'demo'
                    ? 'Demonstração · coordenadas fictícias'
                    : 'Dispositivo do motorista'}{' '}
                  · precisão {Math.round(p.accuracy)} m
                </span>
              </button>
            );
          })}
          {!positions.length && (
            <div className="empty-state">
              <MapPin size={28} />
              <p>Aguardando compartilhamento de localização.</p>
            </div>
          )}
        </div>
      </section>
      <p className="page-note">
        A posição depende da permissão do motorista, de conexão e da página ativa. Uma posição
        antiga permanece identificada como desatualizada.
      </p>
    </>
  );
}
