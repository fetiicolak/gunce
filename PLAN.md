# Günce — Proje Planı

Kişisel görev + takvim uygulaması. Microsoft To Do tarzı listeler, takvimden güne atama ve iPhone'a push bildirim.

## Kısıtlar
- **Sıfır maliyet:** Apple Developer hesabı yok, sadece ücretsiz katmanlar.
- **iPhone'da ana ekrana eklenmiş PWA** olarak çalışacak (iOS 16.4+ Web Push).
- **Çoklu cihaz:** telefon, tablet ve bilgisayar arasında senkron.
- Şimdilik tek kullanıcılı, ama altyapı ileride canlıya almaya veya native uygulamaya dönüştürmeye uygun kurulacak.

## Mimari
| Katman | Teknoloji |
|---|---|
| Frontend | React + TypeScript + Vite, vite-plugin-pwa, Tailwind |
| Barındırma | GitHub Pages (public repo, HTTPS) |
| Backend | Supabase (ücretsiz): Postgres, Auth, Realtime, Edge Functions, pg_cron |
| Bildirim | Web Push (VAPID). pg_cron dakikada bir Edge Function'ı tetikler, o da bildirimleri gönderir |
| Uyku önleme | GitHub Actions 3 günde bir Supabase'e ping atar ve 60 gün kuralına karşı kendini API ile yeniden etkinleştirir (commit gerekmez) |
| Güvenlik | Tüm tablolarda Row Level Security; veriye sadece sahibi erişir |

## Veri modeli
- `lists`: id, user_id, ad, renk, simge, sıra, is_default ("Görevler")
- `items`: id, user_id, list_id, tür (`task` | `reminder`), başlık, not, tarih, saat, `time_explicit`, önemli, my_day, tekrar (jsonb), alt adımlar (jsonb), hatırlatmalar (jsonb), completed_at, sıra, deleted_at (senkron için yumuşak silme)
- `notification_log`: gönderilen bildirimler (aynı bildirimin iki kez gitmemesi için)
- `push_subscriptions`: id, user_id, endpoint, anahtarlar, cihaz adı
- `settings`: varsayılan saat (09:00), özet saati vb.

## Davranış kuralları
- **Saat alanı** 09:00 dolu gelir. Kullanıcı değiştirirse o saat geçerli olur ve `time_explicit = true` olarak kaydedilir.
- **Birden fazla hatırlatma:** hazır seçenekler "Tam zamanında", "15 dk önce", "1 saat önce", "1 gün önce", ayrıca "Özel" tarih ve saat.
- **Tekrarlama** basit bir JSON kuralı ile tutulur (günlük, haftalık gün seçmeli, aylık, özel). Tekrarlayan görev tamamlanınca bir sonraki tekrarı oluşur.
- **Gecikmiş görev** (sadece `task` türü): kırmızı "Gecikmiş" etiketiyle görünür ve **ertesi gün 09:00'da bir kez** daha hatırlatılır. Sonrasında sadece etiketiyle kalır.
- **Bildirim gruplama (karma model):**
  - Saati elle girilmiş öğelerin hatırlatmaları **tek tek**, kendi zamanında gelir.
  - Saati varsayılan 09:00 olan öğeler ve gecikmiş görev hatırlatmaları **09:00'da tek bir günlük özette** gelir, örneğin başlık "30 Nisan · Günce", içerik "4 görev, 1 hatırlatma: Faturayı öde, Eczane, +3".
  - Özet bildirimine dokununca uygulama o günün görünümünde açılır.
- **Tüm cihazlar:** bildirim, kayıtlı tüm abonelik cihazlarına gönderilir.
- iOS bildirim üzerinde buton desteklemediği için tekil bildirime dokununca ilgili öğe açılır. "Tamamlandı" ve "Ertele" işlemleri oradan yapılır.

## Fazlar
**Faz 1: Çekirdek**
- Giriş, listeler ("Görevler" + özel listeler), görev ve hatırlatma CRUD
- Takvim: hafta ve ay görünümü, güne tıklayıp ekleme
- Tekrarlama, çoklu hatırlatma, push aboneliği, bildirim gönderimi (tekil + günlük özet), gecikmiş mantığı
- PWA kurulumu, GitHub Pages yayını, keep-alive workflow

**Faz 2: To Do konforu**
- Akıllı listeler: Günüm, Önemli, Planlanan
- Alt adımlar, önemli işareti
- Takvimde sürükle-bırak
- Bildirimden açılan öğe ekranında Tamamlandı ve Ertele

**Faz 3: Cilalama**
- Karanlık mod, çevrimdışı çalışma ve senkron, arama

## Kurulum adımları (kullanıcı)
1. GitHub hesabı ve `gunce` adında public repo
2. Supabase hesabı ve yeni proje
3. Anahtarların GitHub Secrets'a eklenmesi (yönlendirmeli)
