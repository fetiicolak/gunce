# Günce

Kişisel görev, hatırlatma ve takvim uygulaması. iPhone'da ana ekrana eklenen bir PWA olarak çalışır ve push bildirimi gönderir. Tamamen ücretsiz katmanlarla çalışır: GitHub Pages ve Supabase.

Ayrıntılı plan ve davranış kuralları için [PLAN.md](PLAN.md) dosyasına bakın.

## Geliştirme

```bash
npm install
npm run dev
```

`.env.local` dosyası yoksa uygulama **demo modunda** açılır. Bu modda Supabase'e bağlanmaz, veriler sadece tarayıcıda tutulur. Gerçek bağlantı için `.env.example` dosyasını `.env.local` olarak kopyalayıp değerleri doldurun.

## Klasörler

| Yol | İçerik |
|---|---|
| `src/lib/store.ts` | Yerel-öncelikli veri katmanı: IndexedDB, bekleyen değişiklik kuyruğu (outbox), Supabase senkronu |
| `supabase/functions/_shared/schedule.ts` | Tekrar ve bildirim zamanı hesapları. İstemci ve sunucu ortak kullanır |
| `supabase/functions/dispatch` | Dakikada bir çalışan bildirim gönderici (Web Push) |
| `supabase/migrations` | Veritabanı şeması, güvenlik kuralları ve cron işleri |
| `src/sw.ts` | Service worker: çevrimdışı önbellek, push ve bildirime tıklama |
| `.github/workflows` | GitHub Pages yayını ve Supabase uyku önleyici ping |

## Kurulum (bir kez)

1. **Supabase projesi** oluşturun ve CLI'a giriş yapın:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. **VAPID anahtarları** üretin: `npx web-push generate-vapid-keys`
3. **Fonksiyon sırlarını** ayarlayın ve fonksiyonu yükleyin:
   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=https://<kullanici>.github.io/gunce CRON_SECRET=<rastgele>
   npx supabase functions deploy dispatch --no-verify-jwt
   ```
4. **Cron için Vault sırlarını** ekleyin:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<CRON_SECRET ile aynı>', 'cron_secret');
   ```
5. **GitHub repo değişkenlerini** ekleyin: Settings → Secrets and variables → Actions → *Variables*:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`. Bu değerlerin herkese açık olması sorun değil, veriler RLS ile korunuyor.
6. **GitHub Pages'i** açın: Settings → Pages → Source: *GitHub Actions*.
7. Kendi hesabınızı oluşturduktan sonra Supabase'de **yeni kayıtları kapatın**: Authentication → Sign In / Providers → *Allow new users to sign up* kapalı.

## iPhone'a kurulum

Safari'de siteyi açın, Paylaş → **Ana Ekrana Ekle** yapın. Ana ekrandaki Günce'yi açıp Ayarlar → **Bildirimleri aç** adımını tamamlayın.
