'use client';

import { useEffect, useRef } from 'react';
import { useMatrix } from '@/lib/matrix-provider';

/**
 * Overlay de llamada 1:1 (audio/video). Se monta siempre a nivel de app para que
 * las llamadas entrantes aparezcan sin importar en qué pantalla estés.
 */
export function CallOverlay() {
  const { activeCall, answerCall, rejectCall, hangupCall, setMicMuted, setCameraMuted } = useMatrix();
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const remoteStream = activeCall?.remoteStream ?? null;
  const localStream = activeCall?.localStream ?? null;

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current && remoteStream) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  if (!activeCall) return null;

  const { isVideo, incoming, phase, peerName, micMuted, cameraMuted } = activeCall;
  const ringingIncoming = incoming && phase === 'ringing';
  const statusText =
    phase === 'ringing'
      ? incoming
        ? `${isVideo ? 'Videollamada' : 'Llamada'} entrante`
        : 'Llamando…'
      : phase === 'connecting'
        ? 'Conectando…'
        : phase === 'connected'
          ? 'En llamada'
          : 'Llamada finalizada';

  const initial = peerName.replace(/^@/, '').slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900 text-white">
      {/* Audio remoto (siempre, para que se escuche en audio y video) */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Video remoto a pantalla completa (solo videollamada conectada) */}
      {isVideo && phase === 'connected' ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full bg-black object-cover"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-brand/30 text-4xl font-semibold">
            {initial}
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{peerName}</p>
            <p className="mt-1 text-sm text-slate-300">{statusText}</p>
          </div>
        </div>
      )}

      {/* Video local (PIP) en videollamada */}
      {isVideo && (phase === 'connected' || phase === 'connecting') && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute right-4 top-4 h-40 w-28 rounded-xl border border-white/20 bg-black object-cover shadow-lg"
        />
      )}

      {/* Cabecera con estado en videollamada conectada */}
      {isVideo && phase === 'connected' && (
        <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4">
          <p className="text-lg font-semibold">{peerName}</p>
          <p className="text-xs text-slate-300">{statusText}</p>
        </div>
      )}

      {/* Controles */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent p-8">
        {ringingIncoming ? (
          <>
            <button
              type="button"
              onClick={() => rejectCall()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg hover:bg-red-700"
              aria-label="Rechazar"
              title="Rechazar"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => void answerCall()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-2xl shadow-lg hover:bg-green-700"
              aria-label="Contestar"
              title="Contestar"
            >
              📞
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void setMicMuted(!micMuted)}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-xl shadow-lg ${
                micMuted ? 'bg-white text-slate-900' : 'bg-white/20 hover:bg-white/30'
              }`}
              aria-label={micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
              title={micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
            >
              {micMuted ? '🔇' : '🎤'}
            </button>
            {isVideo && (
              <button
                type="button"
                onClick={() => void setCameraMuted(!cameraMuted)}
                className={`flex h-14 w-14 items-center justify-center rounded-full text-xl shadow-lg ${
                  cameraMuted ? 'bg-white text-slate-900' : 'bg-white/20 hover:bg-white/30'
                }`}
                aria-label={cameraMuted ? 'Encender cámara' : 'Apagar cámara'}
                title={cameraMuted ? 'Encender cámara' : 'Apagar cámara'}
              >
                {cameraMuted ? '📷' : '📹'}
              </button>
            )}
            <button
              type="button"
              onClick={() => hangupCall()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg hover:bg-red-700"
              aria-label="Colgar"
              title="Colgar"
            >
              📵
            </button>
          </>
        )}
      </div>
    </div>
  );
}
