# SAP OData Viewer & OdataGRID

Bu proje, SAP OData servislerini modern bir web arayüzünde, SAP kullanıcılarının alışık olduğu **ALV Grid** (ABAP List Viewer) deneyimiyle görüntülemek, analiz etmek ve dışa aktarmak için geliştirilmiş yüksek performanslı bir React uygulamasıdır. Bileşen adı: **OdataGrid**.

![UI5 Web Components React](https://img.shields.io/badge/UI5--Web--Components-React-blue)
![Vite](https://img.shields.io/badge/Vite-8.0-blueviolet)
![TypeScript](https://img.shields.io/badge/TypeScript-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

## 🎯 Projenin Amacı

SAP danışmanları ve geliştiricileri için OData servislerini hızlıca test edebilecekleri, karmaşık veri setlerini filtreleyip gruplayabilecekleri ve görsel raporlar oluşturabilecekleri bir ortam sunar. Uygulama, SAP'nin standart UI5 tasarım dilini kullanarak kurumsal bir deneyim sağlar.

## ✨ Temel Özellikler

- 📊 **Dinamik Kolon Yapılandırması:** OData `$metadata` servisinden otomatik kolon isimleri, veri tipleri ve teknik detayları okur.
- 🔍 **Gelişmiş OData Filtreleme:**
  - Global arama ve kolon bazlı filtreleme.
  - OData V2 (`substringof`) ve V4 (`contains`) sözdizimi için otomatik dönüştürme.
  - "Enter" ile tetiklenen akıllı sunucu tarafı filtreleme.
  - Filter girdileri için OData escape + kolon ID allowlist (injection koruması).
- 📈 **Veri Analizi ve Grafikler:** Gruplanan verileri anlık olarak Bar Chart formatında raporlama.
- 📂 **Excel Entegrasyonu:** Tek tıkla Excel'e aktarma; CSV/Excel formula injection koruması (`=`, `+`, `-`, `@`, `\t`, `\r` ile başlayan hücreler güvenli prefix'lenir).
- 🌐 **Çoklu Dil Desteği:** Türkçe, İngilizce, Almanca (i18next).
- 🔐 **SAP Bağlantı Yönetimi:**
  - Runtime'da değiştirilebilir SAP host (UI'dan girilir, restart gerekmez).
  - Basic Auth ve cookie tabanlı session.
  - Şifre asla `localStorage`'a yazılmaz; sadece host bilgisi saklanır.
- 📑 **Detay Görünümü (Row Expansion):** Navigation property'ler için satır bazlı genişletilebilir tablolar.

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js v18+
- npm

### Yerel Çalıştırma
```bash
git clone <repo-url>
cd OdataGRID
npm install
npm run dev
```

Uygulama `http://localhost:5173` adresinde açılır. İlk paint'te `https://services.odata.org/V4/TripPinServiceRW/People` (Microsoft OData test servisi) demo verisi yüklenir.

### Üretim Build'i
```bash
npm run build      # tsc -b && vite build
npm run preview    # dist/'i lokal'de serve et
```

## 🏗️ Mimari

Uygulama iki farklı çalışma modunda farklı bir SAP proxy katmanı kullanır:

### Geliştirme (Vite dev server)
- `vite.config.ts` içindeki **dinamik dev middleware** `/sap-api/*` isteklerini, request'in `x-sap-target` header'ında belirtilen host'a yönlendirir.
- Kullanıcı UI'dan SAP host'unu değiştirebilir; sunucu restart gerekmez.

### Üretim (Vercel Serverless)
- Vite SPA olarak `dist/` üretir; Vercel CDN üzerinden serve edilir.
- `/sap-api/*` istekleri `vercel.json` rewrite'ı ile **`api/sap-proxy/[...path].ts`** serverless function'a yönlendirilir.
- Function aşağıdaki sertleştirmelerle çalışır:
  - **Hostname allowlist** — yalnızca `SAP_ALLOWED_HOSTS` env'indeki host'lara proxy.
  - **Yalnızca HTTPS** target.
  - **DNS rebinding savunması** — hostname resolve edilip private IP (RFC1918, loopback, link-local, unique local) reddedilir.
  - **TLS doğrulama açık** (`rejectUnauthorized: true`); self-signed için `NODE_EXTRA_CA_CERTS` env.
  - **Cookie rewrite** — `Domain=` strip; `HttpOnly`, `Secure`, `SameSite=Lax` zorunlu.
  - **Origin/Host eşleşme kontrolü** (cross-origin POST'lar reddedilir).
  - **Rate limit** — IP başı 60 req/dakika (in-memory, best-effort).
  - **Sanitize log** — Authorization header ve response body asla loglanmaz.

## 🌐 Vercel'e Deploy

1. Repo'yu Vercel'e bağla (`Import Project`).
2. **Project Settings → Environment Variables:**
   - `SAP_ALLOWED_HOSTS` — virgülle ayrılmış host listesi (ör. `sap.firma.com,sap2.firma.com`).
   - `NODE_EXTRA_CA_CERTS` (opsiyonel) — SAP self-signed sertifika kullanıyorsa CA bundle yolu.
3. **Project Settings → Deployment Protection:**
   - **Password Protection** (Pro+) veya **Vercel Authentication** (team-only) açılması önerilir — uygulama public bir domain'de barınsa da erişim sınırlanır.
4. Deploy.

`vercel.json` build config'i, SPA fallback'i ve güvenlik header'larını otomatik uygular. Manuel ayar gerekmez.

## 🛡️ Güvenlik Önlemleri

| Önlem | Yer |
|---|---|
| CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | `vercel.json` |
| `noindex`, `nofollow` meta + `X-Robots-Tag` + `robots.txt` | `index.html`, `vercel.json`, `public/robots.txt` |
| OData filter escape (`'` → `''`) + kolon ID allowlist | `src/components/OdataGrid/OdataGrid.tsx` |
| Excel formula injection sanitization | `src/utils/excelExport.ts` |
| Generic kullanıcı hata mesajları (i18n); teknik detay sadece dev console | `src/utils/sapOData.ts`, `src/components/OdataGrid/OdataGrid.tsx` |
| Hassas console.log'ların prod bundle'dan tree-shake edilmesi (`import.meta.env.DEV` guard) | tüm `src/` |
| `.gitignore`'da `.env*` dosyaları | `.gitignore` |

## ⚙️ Konfigürasyon

### SAP Bağlantısı
**"SAP Giriş"** butonu açılan dialog'da SAP host URL'i, kullanıcı adı ve şifre girilir. Login sonrası:
- Şifre state'ten temizlenir.
- Sadece host bilgisi `localStorage`'a kaydedilir (`sap_config_server` anahtarı).
- Sonraki istekler `x-sap-target` header'ı ile dev middleware veya Vercel function'a iletilir; her ikisi de saved host'a proxy'ler.

### Demo OData URL'sini Değiştirme
İlk paint'te yüklenen demo URL'sini değiştirmek için `src/components/OdataGrid/OdataGrid.tsx` içindeki `DEMO_ODATA_URL` sabitini güncelle.

> **Not:** Public bir endpoint kullanırsan, `vercel.json` CSP'sindeki `connect-src`'a o host'u eklemeyi unutma; aksi halde Vercel prod'da bağlantı bloklanır.

## 🛠️ Kullanılan Teknolojiler

- **Frontend:** React 19, TypeScript
- **Build:** Vite 8 (Oxc / Rolldown)
- **UI:** UI5 Web Components for React 2
- **Charts:** Chart.js + react-chartjs-2
- **i18n:** i18next + i18next-browser-languagedetector
- **Excel:** xlsx
- **Deploy:** Vercel (Static + Serverless Functions)

## 📄 Lisans

[MIT](LICENSE)
