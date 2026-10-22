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
- **Ekleme kutusu** `src/components/AddBar.tsx`: tarih/tekrar menüleri (`MenuBox`) yüzen değil, kutunun içinde çiplerin altında açılır ve kendini görünür alana kaydırır; takvimde ekran dışına taşmasın diye böyle. Kapalıyken `defaults.kind` verilmemişse (Günüm, Planlanan, Takvim) solda "Görev ekle", sağda yan yana "Hatırlatma ekle" düğmesi; verilmişse tek tür (listeler `kind: 'task'`, Hatırlatmalar `kind: 'reminder'`). Şeffaf tarih/saat alanları tıklanınca `showPicker()` ile açılır (masaüstü tarayıcı kendiliğinden açmıyor).
- **Birden fazla saat**: hatırlatma türü `{ type: 'time', time: 'HH:mm' }` öğenin (her tekrarın) gününde ek bildirim verir. Ekleme kutusunda "+ Saat" çipi, detayda "O gün başka saatte…". Dispatch, tekrarlayan hatırlatmayı en geç saat (`lastTimeOfDay`) geçmeden sonraki tekrara taşımaz.
- **Birden fazla tarih**: tekrar türü `{ freq: 'dates', dates: [...] }`; `due_date` her zaman en erken tarih, `nextOccurrence` listedeki bir sonraki günü verir. Böylece takvim, tamamlama ve bildirimler ek kod olmadan çalışır. Ekleme kutusunda tarih menüsündeki "Birden fazla tarih…", detayda tekrar seçiminde "Belirli tarihler…".
- **Takvim** `src/pages/CalendarPage.tsx`: gün hücresindeki görev çiplerine tıklamak öğeyi açmaz, sadece o günü seçer (çipler yalnızca sürüklemek için). Öğe, alttaki gün listesinden açılır. Üst çubuk: başlık "Takvim", oklar arasında dönem etiketi (`period`: ay adı, başka yılsa yılıyla; hafta görünümünde hafta aralığı), yanında küçükten büyüğe "Bugün" düğmesi + "Hafta | Ay" seçimi; telefonda oklar ve düğmeler tek satırda.
- **Hatırlatmalar sayfası**: `SmartListPage k="hatirlatmalar"` (`/hatirlatmalar`), menüde varsayılan "Görevler" listesinin hemen altında (`NavContent.tsx`). Liste sayfaları (`ListPage.tsx`) ve liste sayaçları yalnızca görevleri gösterir. Günüm ve Planlanan'da hatırlatmalar görev bölümlerinden ayrı, en altta "Hatırlatmalar" başlığı altında (tarih/saate göre sıralı). Buradan eklenen öğe varsayılan olarak hatırlatmadır (`AddBar` `defaults.kind`). `Shell.tsx`'te `SmartListPage` rotalarına `key` verildi; yoksa sayfalar arası geçişte ekleme kutusunun durumu taşınıyor.
- **Sol menü (geniş ekran/tablet)**: `useUi().navOpen` + `setNavOpen` (`src/lib/ui.ts`, tercih `localStorage` `gunce-nav-open`). Menüdeki "Menüyü kapat" düğmesiyle kapanır, sayfa tam genişlik olur; sol üstteki "Menüyü aç" düğmesiyle açılır (`Shell.tsx`, kapalıyken `main`'e `pl-10`).
- **Tamamlama sesi**: `playDone()` (`src/lib/sound.ts`) `public/sounds/tamamlandi.mp3` "ta-da" sesini çalar; mp3 service worker önbelleğinde (`vite.config.ts` `globPatterns`), çevrimdışı da çalışır. Görev kutusu işaretlenirken `TaskRow.tsx` ve `ItemDetail.tsx`'te çağrılır; işaret kaldırılırken çalmaz.
- **İmleç**: tıklanabilir öğelerde el imleci `src/index.css` sonundaki genel kuralla (button, `role="button"`, link, tarih/saat etiketleri). Tıklanabilir yeni bir `div` eklersen `role="button"` ver ya da `cursor-pointer` ekle.
- **Derleme uyarıları**: `package.json` `overrides` ile `workbox-build`'in eski `glob` sürümü 13'e zorlanıyor (npm "deprecated" uyarısı). `vite.config.ts`'te `sw-code-splitting` eklentisi, PWA eklentisinin service worker için kullandığı eski `inlineDynamicImports` ayarını `codeSplitting: false` ile değiştiriyor. `vite-plugin-pwa`/`workbox-build` güncellenince bunlar gereksiz olabilir; kontrol et. Kütüphaneler `build.rolldownOptions.output.codeSplitting.groups` ile ayrı dosyalara bölünür (react, supabase, dnd, vendor); uygulama kodu `assets/index-*.js`'te kalır.
- **Dispatch yayını otomatik değil**: `supabase/functions/` değişince `npx supabase functions deploy dispatch --no-verify-jwt` ile elle yüklenmeli (GitHub Actions sadece siteyi yayınlar).
- Görev satırı, kaydırarak silme: `src/components/TaskRow.tsx` (`useSwipeToDelete`, onay async).
- Veri katmanı `src/lib/store.ts`, seçiciler `src/lib/selectors.ts`, tekrar/bildirim hesapları `supabase/functions/_shared/schedule.ts`.
