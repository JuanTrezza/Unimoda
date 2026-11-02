import { create } from 'zustand'

export type ToastTone = 'success' | 'info' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  show: (message: string, options?: { tone?: ToastTone; action?: Toast['action']; duration?: number }) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, { tone = 'success', action, duration = 4500 } = {}) => {
    const id = nextId++
    // Máximo 3 a la vez
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone, action }] })
    window.setTimeout(() => get().dismiss(id), duration)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = (...args: Parameters<ToastState['show']>) => useToast.getState().show(...args)
