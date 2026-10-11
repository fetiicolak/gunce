# Günce

Kişisel görev/hatırlatma/takvim PWA'sı (React 19 + Vite + Tailwind, Supabase, GitHub Pages). Genel bilgi [README.md](README.md), davranış kuralları [PLAN.md](PLAN.md).

## Çalışma

- Kullanıcıyla Türkçe konuş; arayüz metinleri, commit mesajları Türkçe.
- Tür denetimi: `npx tsc -b`. Test yok.
- Tarayıcıda denemek için `.claude/launch.json` içindeki `gunce-demo` sunucusu (demo modu, Supabase'siz, giriş gerektirmez).
- Yayın: `main`'e push → `.github/workflows/deploy.yml` → https://fetiicolak.github.io/gunce/ (yaklaşık 30 sn). Commit/push sadece kullanıcı isteyince.
- PWA önbelleği yüzünden değişiklik görünmüyorsa önce canlı paketi kontrol et (`curl` ile `assets/index-*.js` içinde ara), sonra kullanıcıya yenilemeyi öner.

## Nerede ne var

- **Günüm sayfası** `src/pages/SmartListPage.tsx` (`k === 'gunum'` bölümü). `src/components/DayAgenda.tsx` ise Takvim'deki tek gün görünümü; ikisini karıştırma. İkisinde de bugünün öğeleri üstte, "Gecikmiş" altta.
- **Onay soruları**: tarayıcının `confirm()`/`alert()` fonksiyonlarını kullanma. `askConfirm({ title, message?, confirmText?, danger? })` (`src/components/ConfirmDialog.tsx`) Promise<boolean> döner; `ConfirmHost` `main.tsx`'te bağlı.
- Görev satırı, kaydırarak silme: `src/components/TaskRow.tsx` (`useSwipeToDelete`, onay async).
- Veri katmanı `src/lib/store.ts`, seçiciler `src/lib/selectors.ts`, tekrar/bildirim hesapları `supabase/functions/_shared/schedule.ts`.
