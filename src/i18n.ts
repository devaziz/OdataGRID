import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  tr: {
    translation: {
      "app": {
        "title": "ODATA Viewer"
      },
      "toolbar": {
        "searchPlaceholder": "OData Filtre, kolonlara tıklayarak kolay filtreleme yapılabilir",
        "getOdata": "Veri Al",
        "loginSap": "SAP Giriş",
        "totals": "Toplamlar",
        "charts": "Grafik",
        "excel": "Excel",
        "clear": "Filtre Temizle",
        "fetchTooltip": "OData Verisi Çek",
        "settingsTooltip": "SAP Bağlantı Ayarları",
        "totalsTooltip": "Toplamları Göster/Gizle",
        "chartsTooltip": "Grafik Görünümü",
        "excelTooltip": "Excel'e Aktar",
        "clearTooltip": "Filtreleri Temizle",
        "lang": "Dil"
      },
      "dialog": {
        "urlTitle": "SAP OData URL Girişi",
        "settingsTitle": "SAP Bağlantı Ayarları",
        "fetchData": "Verileri Getir",
        "cancel": "İptal",
        "saveAndConnect": "Bağlan ve Kaydet",
        "username": "Kullanıcı Adı",
        "password": "Şifre",
        "serverUrl": "SAP Server URL (IP:Port)",
        "serviceUrl": "OData Servis URL",
        "note": "Not: Kullanıcı adı ve şifre boş bırakılırsa SAP server'ı direkt basic auth. yapılarak sonrasında sadece cookie ile çalışacaktır. Hiçbir şekilde kullanıcı adı ve şifre tutulmamaktadır."
      },
      "table": {
        "loading": "Veriler Çekiliyor...",
        "header": "OData Veri Seti",
        "empty": "Veri çekmek için \"Veri Al\" düğmesini kullanın."
      },
      "errors": {
        "fetchFailed": "Veriler çekilemedi. Bağlantı veya yetkilendirme bilgilerinizi kontrol edin.",
        "loginFailed": "Giriş başarısız. Bilgilerinizi kontrol edin."
      },
      "info": {
        "loginSuccess": "SAP bağlantısı kuruldu."
      }
    }
  },
  en: {
    translation: {
      "app": {
        "title": "ODATA Viewer"
      },
      "toolbar": {
        "searchPlaceholder": "OData Filter, easy filtering by clicking on columns",
        "getOdata": "Get ODATA",
        "loginSap": "Login SAP",
        "totals": "Totals",
        "charts": "Charts",
        "excel": "Excel",
        "clear": "Clear Filters",
        "fetchTooltip": "Fetch OData Data",
        "settingsTooltip": "SAP Connection Settings",
        "totalsTooltip": "Show/Hide Totals",
        "chartsTooltip": "Chart View",
        "excelTooltip": "Export to Excel",
        "clearTooltip": "Clear All Filters",
        "lang": "Language"
      },
      "dialog": {
        "urlTitle": "SAP OData URL Entry",
        "settingsTitle": "SAP Connection Settings",
        "fetchData": "Fetch Data",
        "cancel": "Cancel",
        "saveAndConnect": "Connect and Save",
        "username": "Username",
        "password": "Password",
        "serverUrl": "SAP Server URL (IP:Port)",
        "serviceUrl": "OData Service URL",
        "note": "Note: If username and password are left empty, it will attempt direct basic auth and then work with cookies only. No credentials are stored locally."
      },
      "table": {
        "loading": "Fetching Data...",
        "header": "OData Data Set",
        "empty": "Click \"Get OData\" to load data."
      },
      "errors": {
        "fetchFailed": "Could not fetch data. Check your connection or credentials.",
        "loginFailed": "Login failed. Check your credentials."
      },
      "info": {
        "loginSuccess": "Connected to SAP."
      }
    }
  },
  de: {
    translation: {
      "app": {
        "title": "ODATA Viewer"
      },
      "toolbar": {
        "searchPlaceholder": "OData-Filter, einfaches Filtern durch Klicken auf Spalten",
        "getOdata": "ODATA Abrufen",
        "loginSap": "SAP Anmeldung",
        "totals": "Summen",
        "charts": "Diagramme",
        "excel": "Excel",
        "clear": "Filter Löschen",
        "fetchTooltip": "OData-Daten abrufen",
        "settingsTooltip": "SAP-Verbindungseinstellungen",
        "totalsTooltip": "Summen ein-/ausblenden",
        "chartsTooltip": "Diagrammansicht",
        "excelTooltip": "Nach Excel exportieren",
        "clearTooltip": "Alle Filter löschen",
        "lang": "Sprache"
      },
      "dialog": {
        "urlTitle": "SAP OData URL-Eingabe",
        "settingsTitle": "SAP-Verbindungseinstellungen",
        "fetchData": "Daten abrufen",
        "cancel": "Abbrechen",
        "saveAndConnect": "Verbinden ve Speichern",
        "username": "Benutzername",
        "password": "Passwort",
        "serverUrl": "SAP-Server-URL (IP:Port)",
        "serviceUrl": "OData-Service-URL",
        "note": "Hinweis: Wenn Benutzername und Passwort leer gelassen werden, wird eine direkte Basic-Auth versucht und anschließend nur mit Cookies gearbeitet. Es werden keine Zugangsdaten lokal gespeichert."
      },
      "table": {
        "loading": "Daten werden geladen...",
        "header": "OData-Datensatz",
        "empty": "Klicken Sie auf \"OData Abrufen\", um Daten zu laden."
      },
      "errors": {
        "fetchFailed": "Daten konnten nicht abgerufen werden. Verbindung oder Anmeldeinformationen prüfen.",
        "loginFailed": "Anmeldung fehlgeschlagen. Anmeldeinformationen prüfen."
      },
      "info": {
        "loginSuccess": "Mit SAP verbunden."
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['tr', 'en', 'de'],
    load: 'languageOnly', // tr-TR -> tr
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
