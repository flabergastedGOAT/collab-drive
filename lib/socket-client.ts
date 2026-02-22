'use client';

import { useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 50_000; // ~1 request/min per space to save Vercel invocations
const USE_POLLING = process.env.NEXT_PUBLIC_USE_POLLING === 'true';

export type SpaceSocketHandlers = {
  files?: (data: unknown) => void;
  fileDeleted?: (data: { id: string }) => void;
  members?: (data?: unknown) => void;
  activity?: (data?: unknown) => void;
};

function usePollingOnly(
  spaceId: string | null,
  handlers: SpaceSocketHandlers,
  refetch: (() => void) | undefined,
  pollInterval: number
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!spaceId || !refetchRef.current) return;
    const tick = () => refetchRef.current?.();
    const id = setInterval(tick, pollInterval);
    return () => clearInterval(id);
  }, [spaceId, pollInterval]);
}

// Socket-based real-time (used when not on Vercel / when NEXT_PUBLIC_USE_POLLING is not set)
function useSocketRealTime(
  spaceId: string | null,
  handlers: SpaceSocketHandlers,
  refetch: (() => void) | undefined,
  pollInterval: number
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!spaceId) return;
    let socket: any = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      import('socket.io-client').then(({ io }) => {
        const getUrl = () => {
          if (typeof window === 'undefined') return '';
          const { protocol, hostname, port } = window.location;
          return `${protocol}//${hostname}${port ? ':' + port : ''}`;
        };
        socket = io(getUrl(), { path: '/api/socket', withCredentials: true });
        socket.emit('join', spaceId);

        socket.on('connect', () => {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          fallbackTimer = null;
        });

        socket.on('files', (d: unknown) => handlersRef.current.files?.(d));
        socket.on('fileDeleted', (d: { id: string }) => handlersRef.current.fileDeleted?.(d));
        socket.on('members', () => handlersRef.current.members?.());
        socket.on('activity', (d?: unknown) => handlersRef.current.activity?.(d));

        // If not connected after 3s, fall back to polling (e.g. on Vercel where there is no socket server)
        fallbackTimer = setTimeout(() => {
          if (socket && !socket.connected) {
            socket.disconnect();
            socket = null;
            startPolling();
          }
        }, 3000);
      });
    };

    const startPolling = () => {
      const doRefetch = () => refetchRef.current?.();
      pollIntervalId = setInterval(doRefetch, pollInterval);
    };

    connect();

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (pollIntervalId) clearInterval(pollIntervalId);
      if (socket) {
        socket.emit('leave', spaceId);
        socket.disconnect();
      }
    };
  }, [spaceId, pollInterval]);
}

export function useSpaceSocket(
  spaceId: string | null,
  handlers: SpaceSocketHandlers,
  options?: { refetch?: () => void; pollInterval?: number }
) {
  const refetch = options?.refetch;
  const pollInterval = options?.pollInterval ?? POLL_INTERVAL_MS;

  if (USE_POLLING) {
    usePollingOnly(spaceId, handlers, refetch, pollInterval);
    return null;
  }
  useSocketRealTime(spaceId, handlers, refetch, pollInterval);
  return null;
}
