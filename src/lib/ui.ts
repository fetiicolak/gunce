import { create } from 'zustand'

/** Arayüz durumu (kalıcı değil). `adding`: ekleme kutusu açık; mobilde alt çubuk gizlenir. */
export const useUi = create<{ adding: boolean }>(() => ({ adding: false }))
