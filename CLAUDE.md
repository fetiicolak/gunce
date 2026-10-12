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
- **Ekleme kutusu** `src/components/AddBar.tsx`: tarih/tekrar menüleri (`MenuBox`) yüzen değil, kutunun içinde çiplerin altında açılır ve kendini görünür alana kaydırır; takvimde ekran dışına taşmasın diye böyle. Şeffaf tarih/saat alanları tıklanınca `showPicker()` ile açılır (masaüstü tarayıcı kendiliğinden açmıyor).
- **Birden fazla saat**: hatırlatma türü `{ type: 'time', time: 'HH:mm' }` öğenin (her tekrarın) gününde ek bildirim verir. Ekleme kutusunda "+ Saat" çipi, detayda "O gün başka saatte…". Dispatch, tekrarlayan hatırlatmayı en geç saat (`lastTimeOfDay`) geçmeden sonraki tekrara taşımaz.
- **Birden fazla tarih**: tekrar türü `{ freq: 'dates', dates: [...] }`; `due_date` her zaman en erken tarih, `nextOccurrence` listedeki bir sonraki günü verir. Böylece takvim, tamamlama ve bildirimler ek kod olmadan çalışır. Ekleme kutusunda tarih menüsündeki "Birden fazla tarih…", detayda tekrar seçiminde "Belirli tarihler…".
- **Takvim** `src/pages/CalendarPage.tsx`: gün hücresindeki görev çiplerine tıklamak öğeyi açmaz, sadece o günü seçer (çipler yalnızca sürüklemek için). Öğe, alttaki gün listesinden açılır.
- **Liste sayfası** `src/pages/ListPage.tsx`: görevler üstte, hatırlatmalar ayrı "Hatırlatmalar" başlığı altında.
- **Dispatch yayını otomatik değil**: `supabase/functions/` değişince `npx supabase functions deploy dispatch --no-verify-jwt` ile elle yüklenmeli (GitHub Actions sadece siteyi yayınlar).
- Görev satırı, kaydırarak silme: `src/components/TaskRow.tsx` (`useSwipeToDelete`, onay async).
- Veri katmanı `src/lib/store.ts`, seçiciler `src/lib/selectors.ts`, tekrar/bildirim hesapları `supabase/functions/_shared/schedule.ts`.
