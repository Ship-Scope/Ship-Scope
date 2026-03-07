import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
  };
  dismiss: (id: string) => void;
}

type Action = { type: 'ADD'; toast: Toast } | { type: 'DISMISS'; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD': {
      const next = [...state, action.toast];
      return next.length > 5 ? next.slice(-5) : next;
    }
    case 'DISMISS':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id });
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, description?: string, duration = 5000) => {
      const id = crypto.randomUUID();
      dispatch({ type: 'ADD', toast: { id, type, title, description, duration } });
      const timer = window.setTimeout(() => {
        dispatch({ type: 'DISMISS', id });
        timersRef.current.delete(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [],
  );

  const toast = {
    success: (title: string, description?: string) => addToast('success', title, description),
    error: (title: string, description?: string) => addToast('error', title, description, 8000),
    info: (title: string, description?: string) => addToast('info', title, description),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
