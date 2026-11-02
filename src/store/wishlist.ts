import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WishlistState {
  productIds: string[]
  toggle: (productId: string) => boolean
  remove: (productId: string) => void
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      /** Devuelve true si el producto quedó en favoritos. */
      toggle: (productId) => {
        const has = get().productIds.includes(productId)
        set({ productIds: has ? get().productIds.filter((id) => id !== productId) : [...get().productIds, productId] })
        return !has
      },
      remove: (productId) => set({ productIds: get().productIds.filter((id) => id !== productId) }),
    }),
    { name: 'unimoda-wishlist', version: 1 },
  ),
)
