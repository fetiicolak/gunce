import { create } from 'zustand'

const NAV_KEY = 'gunce-nav-open'
const readNav = () => {
  try {
    return localStorage.getItem(NAV_KEY) !== '0'
  } catch {
    return true
  }
}

/** Arayüz durumu. `adding`: ekleme kutusu açık; mobilde alt çubuk gizlenir.
 *  `navOpen`: geniş ekranda sol menü açık mı (tercih tarayıcıda hatırlanır). */
export const useUi = create<{ adding: boolean; navOpen: boolean }>(() => ({ adding: false, navOpen: readNav() }))

export function setNavOpen(open: boolean) {
  useUi.setState({ navOpen: open })
  try {
    localStorage.setItem(NAV_KEY, open ? '1' : '0')
  } catch {
    /* depolama kapalı olabilir */
  }
}
