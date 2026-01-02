"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface RealtimeContextType {
  isConnected: boolean;
  lastUpdate: Date | null;
  subscribe: (table: string, callback: (payload: any) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Test connection
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (!error) {
          setIsConnected(true);
        }
      } catch (err) {
        console.error('Supabase connection test failed:', err);
        setIsConnected(false);
      }
    };

    testConnection();

    // Set up connection monitoring
    const interval = setInterval(testConnection, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const subscribe = (table: string, callback: (payload: any) => void) => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          setLastUpdate(new Date());
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const value: RealtimeContextType = {
    isConnected,
    lastUpdate,
    subscribe,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

// Hook for subscribing to specific table changes
export function useRealtimeSubscription(
  table: string,
  callback: (payload: any) => void,
  enabled: boolean = true
) {
  const { subscribe } = useRealtime();

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribe(table, callback);
    return unsubscribe;
  }, [table, callback, enabled, subscribe]);
}