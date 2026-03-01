import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_PB_URL ?? 'http://localhost:8090')

// The SDK automatically restores the auth token from localStorage on construction.
// pb.authStore.isValid is already correct at import time — no network call needed.
