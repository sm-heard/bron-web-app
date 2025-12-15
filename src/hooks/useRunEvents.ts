'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RunEvent } from '@/types/db';

interface UseRunEventsOptions {
  /** Whether to use SSE (true) or polling fallback (false) */
  useSSE?: boolean;
  /** Polling interval in ms when using fallback */
  pollInterval?: number;
  /** Called when run completes */
  onComplete?: (status: string) => void;
  /** Called on connection error */
  onError?: (error: Error) => void;
}

interface UseRunEventsResult {
  events: RunEvent[];
  isConnected: boolean;
  isComplete: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useRunEvents(
  runId: string | null,
  options: UseRunEventsOptions = {}
): UseRunEventsResult {
  const {
    useSSE = true,
    pollInterval = 2000,
    onComplete,
    onError,
  } = options;

  const [events, setEvents] = useState<RunEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!runId || !useSSE) return;

    cleanup();
    setError(null);

    const eventSource = new EventSource(`/api/runs/${runId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.addEventListener('connected', () => {
      setIsConnected(true);
    });

    // Handle all event types
    const eventTypes = ['status', 'log', 'message', 'tool', 'ui', 'artifact', 'child_run'];
    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, (e: MessageEvent) => {
        try {
          const eventData = JSON.parse(e.data);
          setEvents((prev) => {
            // Deduplicate by id
            if (prev.some((evt) => evt.id === eventData.id)) {
              return prev;
            }
            return [...prev, eventData as RunEvent];
          });
        } catch (err) {
          console.error('Failed to parse event:', err);
        }
      });
    });

    eventSource.addEventListener('complete', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setIsComplete(true);
        setIsConnected(false);
        onComplete?.(data.status);
        cleanup();
      } catch (err) {
        console.error('Failed to parse complete event:', err);
      }
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setError(data.message);
        onError?.(new Error(data.message));
      } catch {
        // SSE connection error, not a data error
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);

      // Don't reconnect if run is complete
      if (isComplete) {
        cleanup();
        return;
      }

      // Exponential backoff reconnection
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setError('Connection lost. Please refresh the page.');
        onError?.(new Error('Max reconnection attempts reached'));
        cleanup();
      }
    };
  }, [runId, useSSE, cleanup, isComplete, onComplete, onError]);

  // Polling fallback
  useEffect(() => {
    if (!runId || useSSE) return;

    let isActive = true;

    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}/events`);
        if (!response.ok) throw new Error('Failed to fetch events');
        const data = await response.json();
        if (isActive) {
          setEvents(data);
          setIsConnected(true);
          setError(null);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsConnected(false);
        }
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [runId, useSSE, pollInterval]);

  // SSE connection
  useEffect(() => {
    if (useSSE && runId) {
      connect();
    }

    return cleanup;
  }, [runId, useSSE, connect, cleanup]);

  // Reset state when runId changes
  useEffect(() => {
    setEvents([]);
    setIsComplete(false);
    setError(null);
    reconnectAttempts.current = 0;
  }, [runId]);

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return {
    events,
    isConnected,
    isComplete,
    error,
    reconnect,
  };
}
