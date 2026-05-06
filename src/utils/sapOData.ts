export interface SAPConfig {
  server?: string;
  username?: string;
  password?: string;
}

// Returns the SAP host origin (scheme + host + port) from config or, as a fallback,
// from localStorage where the Login dialog persisted it. Used as the `x-sap-target`
// header value so the dev-server proxy knows where to forward the request.
const getSapTarget = (config?: SAPConfig): string | null => {
  const raw = config?.server || (typeof localStorage !== 'undefined' ? localStorage.getItem('sap_config_server') : null);
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

export const loginSAP = async (config: SAPConfig) => {
  if (!config.server) {
    throw new Error("Lütfen Server URL alanını doldurunuz.");
  }

  const target = getSapTarget(config);
  if (!target) {
    throw new Error("Server URL geçersiz. Örn: https://host:port");
  }

  // Hit a known SAP path so we can verify the host is actually a SAP gateway.
  const proxyUrl = "/sap-api/sap/opu/odata/sap/?$format=json";

  const headers: any = {
    'Accept': 'application/json',
    'x-sap-target': target,
  };
  if (config.username && config.password) {
    const auth = btoa(`${config.username}:${config.password}`);
    headers['Authorization'] = `Basic ${auth}`;
  }

  let response: Response;
  try {
    response = await fetch(proxyUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
      // Always hit the upstream so SAP can return a fresh 401 +
      // WWW-Authenticate (which the browser needs to surface its native
      // basic-auth dialog when credentials are empty). Cached 304s would
      // strip those headers.
      cache: 'no-store',
    });
  } catch (e: any) {
    throw new Error(`SAP sunucusuna ulaşılamadı: ${e.message}`);
  }

  // 502 = proxy/network error to SAP host (unreachable, DNS, TLS, etc.)
  if (response.status === 502) {
    const body = await response.text().catch(() => '');
    throw new Error(`SAP sunucusuna bağlanılamadı (502). ${body || 'Sunucu erişilebilir değil.'}`);
  }

  if (response.status === 401 && config.username) {
    throw new Error("Kullanıcı adı veya şifre hatalı.");
  }

  // Empty-creds 401 is the expected "browser-handled auth" path.
  // 2xx and 404 (some SAP gateways block the listing path) are also acceptable —
  // they prove the host is reachable and any cookies are now stored.
  if (response.ok || response.status === 404 || response.status === 401) {
    return true;
  }

  throw new Error(`Bağlantı hatası: ${response.status}`);
};

export const fetchSAPMetadata = async (dataUrl: string, config?: SAPConfig) => {
  if (import.meta.env.DEV) console.log("Fetching metadata for:", dataUrl);
  try {
    let baseUrl = dataUrl.split('?')[0];
    const queryParams = dataUrl.split('?')[1];
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const segments = baseUrl.split('/');
    let entitySetName = segments.pop() || "";

    if (entitySetName.includes('(')) {
      entitySetName = entitySetName.split('(')[0];
    }

    // Auth params from URL (fallback)
    let metadataQuery = "";
    if (queryParams) {
      const authParams = queryParams.split('&').filter(p =>
        p.startsWith('sap-client') ||
        p.startsWith('sap-language')
      );
      if (authParams.length > 0) {
        metadataQuery = "?" + authParams.join('&');
      }
    }

    const metadataUrl = segments.join('/') + '/$metadata' + metadataQuery;

    // Robust Proxy & URL Handling
    let finalUrl = metadataUrl;
    try {
      const urlObj = new URL(finalUrl);
      if (urlObj.pathname.startsWith('/sap/')) {
        finalUrl = "/sap-api" + urlObj.pathname + urlObj.search;
      }
    } catch (e) {
      if (finalUrl.startsWith('/sap/')) {
        finalUrl = `/sap-api${finalUrl}`;
      }
    }

    const isProxied = finalUrl.startsWith('/sap-api');

    const headers: any = { 'Accept': 'application/xml' };
    if (isProxied) {
      const target = getSapTarget(config);
      if (!target) {
        throw new Error("SAP server adresi tanımlı değil. Önce 'Login SAP' ile bağlanın.");
      }
      headers['x-sap-target'] = target;
      if (config?.username && config?.password) {
        const auth = btoa(`${config.username}:${config.password}`);
        headers['Authorization'] = `Basic ${auth}`;
      }
    }

    if (import.meta.env.DEV) console.log("Final metadata URL:", finalUrl);

    const response = await fetch(finalUrl, {
      headers,
      mode: 'cors',
      credentials: isProxied ? 'include' : 'same-origin'
    });
    if (!response.ok) throw new Error(`Metadata fetch failed: ${response.status}`);

    // Detect OData Version
    let odataVersion = "2.0";
    const vHeader = response.headers.get("odata-version") || response.headers.get("dataserviceversion");
    if (vHeader) {
      if (vHeader.includes("4.0")) odataVersion = "4.0";
      else if (vHeader.includes("3.0")) odataVersion = "3.0";
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // XML level version detection
    const edmx = xmlDoc.getElementsByTagName("edmx:Edmx")[0] || xmlDoc.getElementsByTagName("Edmx")[0];
    const dataService = xmlDoc.getElementsByTagName("edmx:DataServices")[0] || xmlDoc.getElementsByTagName("DataServices")[0];
    
    if (edmx && edmx.getAttribute("Version") === "4.0") odataVersion = "4.0";
    if (dataService && dataService.getAttribute("m:DataServiceVersion") === "2.0") odataVersion = "2.0";
    
    if (import.meta.env.DEV) console.log(`[Metadata] Detected OData standard: ${odataVersion}`);

    const entitySets = xmlDoc.getElementsByTagName("EntitySet");
    let entitySet = null;
    for (let i = 0; i < entitySets.length; i++) {
      if (entitySets[i].getAttribute("Name") === entitySetName) {
        entitySet = entitySets[i];
        break;
      }
    }

    if (!entitySet) return { columns: [], odataVersion };

    const entityTypeFullName = entitySet.getAttribute("EntityType");
    const entityTypeName = entityTypeFullName?.split('.').pop();

    const entityTypes = xmlDoc.getElementsByTagName("EntityType");
    let entityType = null;
    for (let i = 0; i < entityTypes.length; i++) {
      if (entityTypes[i].getAttribute("Name") === entityTypeName) {
        entityType = entityTypes[i];
        break;
      }
    }

    if (!entityType) return { columns: [], odataVersion };

    const properties = entityType.getElementsByTagName("Property");
    const columns: any[] = [];

    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      const name = prop.getAttribute("Name");
      const label = prop.getAttribute("sap:label") || name;
      const type = prop.getAttribute("Type");
      const isFilterable = prop.getAttribute("sap:filterable") !== "false";
      const isSortable = prop.getAttribute("sap:sortable") !== "false";

      const colDef: any = {
        field: name,
        headerName: label,
        filter: isFilterable,
        sortable: isSortable,
        minWidth: 150
      };

      if (type === "Edm.DateTime" || type === "Edm.DateTimeOffset") {
        colDef.valueFormatter = (params: any) => {
          if (!params.value) return '';
          const match = params.value.toString().match(/\/Date\((\d+)\)\//);
          if (match) return new Date(parseInt(match[1])).toLocaleDateString('tr-TR');
          const date = new Date(params.value);
          return isNaN(date.getTime()) ? params.value : date.toLocaleDateString('tr-TR');
        };
      } else if (type === "Edm.Time") {
        colDef.valueFormatter = (params: any) => {
          if (!params.value) return '';
          const timeMatch = params.value.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
          if (!timeMatch) return params.value;
          const h = (timeMatch[1] || '00H').replace('H', '').padStart(2, '0');
          const m = (timeMatch[2] || '00M').replace('M', '').padStart(2, '0');
          const s = (timeMatch[3] || '00S').replace('S', '').padStart(2, '0');
          return `${h}:${m}:${s}`;
        };
      } else if (["Edm.Decimal", "Edm.Int32", "Edm.Int16", "Edm.Int64", "Edm.Double", "Edm.Single"].includes(type || "")) {
        colDef.aggFunc = 'sum';
        colDef.type = 'numericColumn';
        colDef.valueFormatter = (params: any) => {
          if (params.value === null || params.value === undefined) return '';
          const val = typeof params.value === 'string' ? parseFloat(params.value) : params.value;
          if (isNaN(val)) return params.value;
          return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: (type === "Edm.Decimal" || type === "Edm.Double") ? 2 : 0,
            maximumFractionDigits: 2
          }).format(val);
        };
        colDef.cellStyle = { textAlign: 'right', fontFamily: 'monospace' };
      }

      if (["PersonelAdi", "Modul", "MusteriAdi", "Category", "UserName"].includes(name || "")) {
        colDef.rowGroup = true;
        colDef.hide = true;
      }
      columns.push(colDef);
    }
    return { columns, odataVersion };
  } catch (error) {
    if (import.meta.env.DEV) console.error("Metadata parsing error:", error);
    return null;
  }
};

export const fetchSAPData = async (customUrl?: string, config?: SAPConfig, lang: string = 'tr') => {
  let url = customUrl || "/sap/opu/odata/sap/YMONO_AKT_PLN_SRV/SummarySet?$format=json";
  const isSapService = url.includes('/sap/opu/');

  // Robust Proxy & URL Handling
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.startsWith('/sap/')) {
      url = "/sap-api" + urlObj.pathname + urlObj.search;
    }
  } catch (e) {
    if (url.startsWith('/sap/')) {
      url = `/sap-api${url}`;
    }
  }

  try {
    const isProxied = url.startsWith('/sap-api');
    const headers: any = {
      'Accept': 'application/json'
    };

    // Add sap-language header if it's a SAP service
    if (isSapService) {
      headers['sap-language'] = lang.toUpperCase().substring(0, 2);
    }

    if (isProxied) {
      const target = getSapTarget(config);
      if (!target) {
        throw new Error("SAP server adresi tanımlı değil. Önce 'Login SAP' ile bağlanın.");
      }
      headers['x-sap-target'] = target;
      if (config?.username && config?.password) {
        const auth = btoa(`${config.username}:${config.password}`);
        headers['Authorization'] = `Basic ${auth}`;
      }
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: isProxied ? headers : { 'Accept': 'application/json' },
      mode: 'cors',
      credentials: isProxied ? 'include' : 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`OData Hatası: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    let results = [];
    if (data.d && data.d.results) results = data.d.results;
    else if (data.value) results = data.value;
    else if (Array.isArray(data)) results = data;
    else results = data.d ? data.d : [data];

    if (!Array.isArray(results)) results = [results];

    return results.map((row: any) => {
      const newRow = { ...row };
      Object.keys(newRow).forEach(key => {
        if (typeof newRow[key] === 'string' && /^-?\d+(\.\d+)?$/.test(newRow[key])) {
          const val = parseFloat(newRow[key]);
          if (!isNaN(val)) newRow[key] = val;
        }
      });
      return newRow;
    });
  } catch (error) {
    if (import.meta.env.DEV) console.error("OData fetch error:", error);
    throw error;
  }
};

// Placeholder for legacy support, will be replaced by dynamic columns
export const sapColumnDefs = [
  { field: "PersonelAdi", headerName: "Personel Adı", minWidth: 150, rowGroup: true, hide: true },
  { field: "Modul", headerName: "Ana Modül", minWidth: 120, rowGroup: true, hide: true },
  { field: "Customer", headerName: "Müşteri", minWidth: 150, filter: true },
  { field: "ProjeTxt", headerName: "Proje Tanımı", minWidth: 200, filter: true },
  { field: "Tarih", headerName: "Plan Tarihi", minWidth: 120 },
  { field: "Sure", headerName: "Süre (Saat)", minWidth: 100, aggFunc: 'sum' },
  { field: "Aciklama", headerName: "Açıklama", minWidth: 250, filter: true }
];
