import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** El carrito guarda solo id de variante y cantidad. El precio se lee siempre del catálogo. */
export interface CartItem {
  variantId: string
  quantity: number
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  add: (variantId: string, quantity: number, maxStock: number) => void
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  clear: () => void
  open: () => void
  close: () => void
}

export const MAX_PER_ITEM = 10

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      add: (variantId, quantity, maxStock) =>
        set((state) => {
          const limit = Math.min(maxStock, MAX_PER_ITEM)
          const existing = state.items.find((i) => i.variantId === variantId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === variantId ? { ...i, quantity: Math.min(i.quantity + quantity, limit) } : i,
              ),
            }
          }
          return { items: [...state.items, { variantId, quantity: Math.min(quantity, limit) }] }
        }),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
        })),
      remove: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'unimoda-cart',
      version: 1,
      partialize: (state) => ({ items: state.items }),
    },
  ),
)

export const selectCartCount = (state: CartState) => state.items.reduce((sum, i) => sum + i.quantity, 0)
