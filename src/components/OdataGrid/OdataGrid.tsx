import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AnalyticalTable as AnalyticalTableBase,
  Dialog as DialogBase,
  Button,
  Label,
  Input,
  Bar as UI5Bar,
  FlexBox,
  FlexBoxDirection,
} from '@ui5/webcomponents-react';

// UI5 React v2 narrowed some prop types (onAfterClose, subComponentHeight)
// that the underlying web components still accept at runtime. Cast both
// components to any so the build passes without changing runtime behavior.
const AnalyticalTable = AnalyticalTableBase as any;
const Dialog = DialogBase as any;
import { Toolbar } from './Toolbar';
import './OdataGrid.css';
import { exportToExcel } from '../../utils/excelExport';
import { fetchSAPData, fetchSAPMetadata, sapColumnDefs, loginSAP } from '../../utils/sapOData';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface OdataGridProps {
  rowData: any[];
  columnDefs: any[];
  title?: string;
}

export const OdataGrid: React.FC<OdataGridProps> = ({ rowData: initialRowData, columnDefs: initialColumnDefs, title }) => {
  const { t, i18n } = useTranslation();
  const [showCharts, setShowCharts] = useState(false);
  const [showTotals, setShowTotals] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [groupBy] = useState<string[]>([]);
  const [tableKey, setTableKey] = useState(0);

  const [gridData, setGridData] = useState(initialRowData);
  const [gridColumns, setGridColumns] = useState(initialColumnDefs);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const DEMO_ODATA_URL = "https://services.odata.org/V4/TripPinServiceRW/People";

  const [sapUrl, setSapUrl] = useState(DEMO_ODATA_URL);

  const [sapConfig, setSapConfig] = useState(() => {
    const saved = localStorage.getItem('sap_config_server');
    return { server: saved || "https://mysapserver.com:mySapServerPort", username: "", password: "" };
  });

  const [odataVersion, setOdataVersion] = useState<string>("2.0");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setGridData([]);
        const data = await fetchSAPData(DEMO_ODATA_URL, undefined, i18n.language);
        setGridData(data);
        const meta = await fetchSAPMetadata(DEMO_ODATA_URL, undefined);
        if (meta && meta.columns && meta.columns.length > 0) {
          setGridColumns(meta.columns);
          setOdataVersion(meta.odataVersion || "2.0");
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error("Initial demo load failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Core Handlers (Defined first) ---

  // Track the last key pressed globally within the grid
  const lastKeyRef = React.useRef<string>("");
  // Ref to hold current table filters as a Map (columnId -> filterValue)
  const filtersMapRef = React.useRef<Map<string, string>>(new Map());

  // OData injection guards.
  // - Column identifiers: only ASCII identifiers (matches OData EDM field naming).
  //   Anything outside this set is dropped from the filter string.
  // - String literals: OData escape rule is to double the single quote.
  const isValidColId = (colId: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(colId);
  const escapeODataString = (s: string): string => String(s).replace(/'/g, "''");

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    lastKeyRef.current = e.key;
    if (e.key === "Enter") {
      const filterParts: string[] = [];
      const isV4 = odataVersion === "4.0";

      filtersMapRef.current.forEach((val, colId) => {
        if (!val) return;
        if (!isValidColId(colId)) return;
        const safeVal = escapeODataString(val);
        const part = isV4
          ? `contains(${colId}, '${safeVal}')`
          : `substringof('${safeVal}',${colId}) eq true`;
        filterParts.push(part);
      });

      const odataFilter = filterParts.join(' and ');
      if (import.meta.env.DEV) console.log("Enter: applying filters:", odataFilter);
      applyODataFilter(odataFilter, true);

      setTimeout(() => {
        lastKeyRef.current = "";
      }, 500);
    }
  };

  const applyODataFilter = useCallback(async (filterValue: string, force: boolean = false) => {
    const isClearAction = filterValue === "" || filterValue === null;

    if (!force && !isClearAction && lastKeyRef.current !== "Enter") {
      return;
    }

    if (import.meta.env.DEV) console.log(`Applying OData ${odataVersion} filter:`, filterValue || "(reset)");
    setGridData([]);
    setLoading(true);

    try {
      let finalUrl = sapUrl;
      if (filterValue) {
        const isV4 = odataVersion === "4.0";
        let odataFilter = filterValue.trim();

        // SAP V2 substringof normalization (whitespace-strict gateway).
        if (!isV4 && odataFilter.includes('substringof')) {
          odataFilter = odataFilter.replace(/substringof\('(.*)',\s+(.*)\)/g, "substringof('$1',$2)");
          if (!odataFilter.includes(' eq true')) {
            odataFilter = `${odataFilter} eq true`;
          }
        }

        // V2 -> V4 conversion (existing behavior). Note: input was already
        // produced via escapeODataString upstream, so we do not re-escape here.
        if (isV4 && odataFilter.includes('substringof')) {
          const match = odataFilter.match(/substringof\('(.*)',\s*(.*)\)/);
          if (match) {
            odataFilter = `contains(${match[2]}, '${match[1]}')`;
          }
        }

        const separator = finalUrl.includes('?') ? '&' : '?';
        if (finalUrl.includes('/sap/opu/')) {
          finalUrl = `${finalUrl}${separator}a=b$filter=${encodeURIComponent(odataFilter)}`;
        } else {
          finalUrl = `${finalUrl}${separator}$filter=${encodeURIComponent(odataFilter)}`;
        }
      }

      const data = await fetchSAPData(finalUrl, undefined, i18n.language);
      setGridData(data);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("Filter request failed:", error);
    } finally {
      setLoading(false);
      lastKeyRef.current = "";
    }
  }, [sapUrl, odataVersion, i18n.language]);

  const handleDialogSubmit = async () => {
    setIsDialogOpen(false);
    setGridData([]);
    setLoading(true);
    try {
      const data = await fetchSAPData(sapUrl, sapConfig, i18n.language);
      setGridData(data);
      const meta = await fetchSAPMetadata(sapUrl, sapConfig);
      if (meta && meta.columns && meta.columns.length > 0) {
        setGridColumns(meta.columns);
        setOdataVersion(meta.odataVersion || "2.0");
      } else {
        setGridColumns(sapColumnDefs);
        setOdataVersion("2.0");
      }
      setTableKey(prev => prev + 1);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("Fetch failed:", error);
      alert(t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSave = async () => {
    setLoading(true);
    try {
      await loginSAP(sapConfig);
      localStorage.setItem('sap_config_server', sapConfig.server || "");
      setSapConfig(prev => ({ ...prev, username: "", password: "" }));
      setIsSettingsOpen(false);
      alert(t('info.loginSuccess'));
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("Login failed:", error);
      alert(t('errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onSearch = useCallback((value: string) => {
    setSearchFilter(value);
  }, []);

  const onSearchSubmit = useCallback((value: string) => {
    applyODataFilter(value, true);
  }, [applyODataFilter]);

  const onExport = useCallback(() => {
    exportToExcel(gridData, title || 'Odata_Export');
  }, [gridData, title]);

  const onClearFilters = useCallback(() => {
    setSearchFilter('');
    if (filtersMapRef.current) filtersMapRef.current.clear();
    applyODataFilter('', true);
    setTableKey(prev => prev + 1);
  }, [applyODataFilter]);

  const onFetchSAP = () => {
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  // --- Memos ---

  const filteredData = gridData || [];

  const chartData = useMemo(() => {
    if (!showCharts || filteredData.length === 0) {
      return { labels: [], datasets: [] };
    }

    const categories = new Map<string, number>();
    const groupedColId = groupBy.length > 0 ? groupBy[0] : null;
    const groupedColumn = gridColumns.find(c => (groupedColId ? (c.field === groupedColId || c.colId === groupedColId) : c.rowGroup));
    const categoryField = groupedColumn?.field || groupedColumn?.colId || gridColumns.find(c => c.filter)?.field || 'category';

    const valueColumn = gridColumns.find(c => c.aggFunc === 'sum');
    const valueField = valueColumn?.field || 'price';

    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      const cat = item[categoryField] || 'Diğer';
      const value = typeof item[valueField] === 'number' ? item[valueField] : parseFloat(item[valueField] || 0);
      const current = categories.get(cat) || 0;
      categories.set(cat, current + (isNaN(value) ? 0 : value));
    }

    return {
      labels: Array.from(categories.keys()),
      datasets: [
        {
          label: `${valueColumn?.headerName || 'Toplam'} (${groupedColumn?.headerName || 'Genel'})`,
          data: Array.from(categories.values()),
          backgroundColor: 'rgba(0, 100, 210, 0.6)',
          borderColor: 'rgba(0, 100, 210, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [filteredData, gridColumns, groupBy, showCharts]);

  const ui5Columns = useMemo(() => {
    return gridColumns.map(col => {
      const isNumeric = col.aggFunc === 'sum';
      return {
        Header: col.headerName,
        accessor: col.field || col.colId,
        id: col.field || col.colId,
        width: col.width,
        minWidth: col.minWidth,
        disableGroupBy: false,
        canGroupBy: true,
        ...(isNumeric && {
          aggregate: 'sum',
          Cell: (instance: any) => {
            const { value, row } = instance;
            const val = typeof value === 'string' ? parseFloat(value) : value;
            if (val === null || val === undefined || isNaN(val)) return value;
            const formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
            return <div style={{ textAlign: 'right', width: '100%', fontFamily: 'monospace', fontWeight: row.canExpand ? 'bold' : 'normal' }}>{formatted}</div>;
          },
          Footer: (info: any) => {
            if (!showTotals) return null;
            const total = info.rows.reduce((sum: number, row: any) => {
              const val = row.values[info.column.id];
              return sum + (val ? parseFloat(val) : 0);
            }, 0);
            return <div style={{ textAlign: 'right', width: '100%', fontWeight: 'bold' }}>{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(total)}</div>;
          }
        }),
        ...(!isNumeric && col.valueFormatter && {
          Cell: (instance: any) => <span>{col.valueFormatter({ value: instance.value })}</span>
        }),
        ...(col.cellStyle && !isNumeric && {
          Cell: (instance: any) => <span style={col.cellStyle}>{instance.value}</span>
        })
      };
    });
  }, [gridColumns, showTotals]);

  const renderRowSubComponent = useCallback((row: any) => {
    if (row.isGrouped || !row.original) return null;
    const data = row.original;
    const expandedKeys = Object.keys(data).filter(key => {
      const val = data[key];
      return key !== '__metadata' && val !== null && typeof val === 'object' && !val.__deferred &&
        ((Array.isArray(val) && val.length > 0) || (val.results && val.results.length > 0) || Object.keys(val).filter(k => k !== '__metadata' && k !== 'results').length > 0);
    });

    if (expandedKeys.length === 0) return null;

    return (
      <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
        <FlexBox direction={FlexBoxDirection.Column}>
          {expandedKeys.map(key => {
            let nestedData = data[key];
            if (nestedData && nestedData.results) nestedData = nestedData.results;
            const isArray = Array.isArray(nestedData);
            const displayData = isArray ? nestedData : [nestedData];
            if (isArray && nestedData.length === 0) return null;

            // Check if it's a primitive array (e.g., ["email1", "email2"])
            const isPrimitiveArray = isArray && typeof displayData[0] !== 'object';

            const columns = isPrimitiveArray
              ? [{ Header: 'Değer', accessor: (d: any) => d, id: 'value', minWidth: 200 }]
              : Object.keys(displayData[0] || {}).filter(k => k !== '__metadata').map(k => ({ Header: k, accessor: k, minWidth: 120 }));

            return (
              <div key={key} style={{ marginBottom: '2rem', backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #0064d2' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ backgroundColor: '#0064d2', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{isArray ? 'LİSTE' : 'DETAY'}</span>
                  {key}
                </h4>
                <AnalyticalTable
                  data={displayData}
                  columns={columns}
                  visibleRows={Math.min(displayData.length, 5)}
                  minRows={1}
                  alternateRowColor
                  header={null}
                />
              </div>
            );
          })}
        </FlexBox>
      </div>
    );
  }, []);

  return (
    <div className="odata-container">
      <Toolbar
        onSearch={onSearch}
        onSearchSubmit={onSearchSubmit}
        onExport={onExport}
        onToggleCharts={() => setShowCharts(!showCharts)}
        onToggleTotals={() => setShowTotals(!showTotals)}
        onClearFilters={() => {
          filtersMapRef.current.clear();
          onClearFilters();
        }}
        onFetchSAP={onFetchSAP}
        onShowSettings={() => setIsSettingsOpen(true)}
        showCharts={showCharts}
        showTotals={showTotals}
        searchValue={searchFilter}
      />

      <div
        className="odata-grid-wrapper"
        onKeyDownCapture={handleTableKeyDown}
      >
        <AnalyticalTable
          key={tableKey}
          data={filteredData}
          columns={ui5Columns}
          loading={loading}
          filterable={true}
          sortable={true}
          groupable={true}
          groupBy={groupBy}
          reactTableOptions={{ manualFilters: true }}
          onFilter={(e: any) => {
            // In v2+, onFilter is used for all filtering events
            // We update the map based on the current change
            const colId = e.columnId;
            const val = e.value;

            if (colId) {
              if (val === undefined || val === "") {
                filtersMapRef.current.delete(colId);
              } else {
                filtersMapRef.current.set(colId, val);
              }
            }

            // Also check if e.filters exists for bulk updates (some versions)
            if (e.filters) {
              e.filters.forEach((f: any) => {
                const id = f.id || (f.column && f.column.id);
                if (id) filtersMapRef.current.set(id, f.value);
              });
            }
          }}
          visibleRows={30}
          minRows={30}
          style={{ height: '100%' }}
          alternateRowColor={true}
          header={loading ? t('table.loading') : (gridData.length === 0 ? t('table.empty') : "")}
          renderRowSubComponent={renderRowSubComponent}
          subComponentHeight={300}
        />
      </div>

      {showCharts && (
        <Dialog
          open={showCharts}
          headerText="OData Veri Analizi"
          onAfterClose={() => setShowCharts(false)}
          footer={<UI5Bar design="Footer" endContent={<Button onClick={() => setShowCharts(false)}>Kapat</Button>} />}
        >
          <div style={{ padding: '1rem', width: '80vw', height: '60vh' }}>
            <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' as const }, title: { display: true, text: 'Veri Dağılım Grafiği' } } }} />
          </div>
        </Dialog>
      )}

      <Dialog
        open={isDialogOpen}
        headerText={t('dialog.urlTitle')}
        onAfterClose={handleDialogClose}
        footer={<UI5Bar design="Footer" endContent={<><Button design="Emphasized" onClick={handleDialogSubmit}>{t('dialog.fetchData')}</Button><Button onClick={handleDialogClose}>{t('dialog.cancel')}</Button></>} />}
      >
        <FlexBox direction={FlexBoxDirection.Column} style={{ padding: '1rem', minWidth: '400px' }}>
          <Label for="sapUrlInput" showColon>{t('dialog.serviceUrl')}</Label>
          <Input id="sapUrlInput" value={sapUrl} onInput={(e: any) => setSapUrl(e.target.value)} style={{ width: '100%', marginTop: '0.5rem' }} placeholder="/sap/opu/odata/sap/..." />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Girdiğiniz URL belirtilen SAP sunucusu üzerinden sorgulanacaktır.<br />
            <strong>Direct:</strong> https://mysapserver.com:mySapServerPort/sap/opu/odata/sap/myService/myEntitySet?$format=json<br />
            <strong>Login:</strong> /sap/opu/odata/sap/myService/myEntitySet?$format=json
          </p>
        </FlexBox>
      </Dialog>

      <Dialog
        open={isSettingsOpen}
        headerText={t('dialog.settingsTitle')}
        onAfterClose={() => setIsSettingsOpen(false)}
        footer={<UI5Bar design="Footer" endContent={<><Button design="Emphasized" onClick={handleSettingsSave} loading={loading}>{t('dialog.saveAndConnect')}</Button><Button onClick={() => setIsSettingsOpen(false)}>{t('dialog.cancel')}</Button></>} />}
      >
        <FlexBox direction={FlexBoxDirection.Column} style={{ padding: '1.5rem', minWidth: '450px', gap: '1rem' }}>
          <FlexBox direction={FlexBoxDirection.Column}>
            <Label showColon>{t('dialog.serverUrl')}</Label>
            <Input
              value={sapConfig.server}
              onInput={(e: any) => setSapConfig({ ...sapConfig, server: e.target.value })}
              placeholder="https://mysapserver.com:mySapServerPort"
              style={{ width: '100%' }}
            />
          </FlexBox>
          <FlexBox direction={FlexBoxDirection.Column}>
            <Label showColon>{t('dialog.username')}</Label>
            <Input
              value={sapConfig.username}
              onInput={(e: any) => setSapConfig({ ...sapConfig, username: e.target.value })}
              style={{ width: '100%' }}
            />
          </FlexBox>
          <FlexBox direction={FlexBoxDirection.Column}>
            <Label showColon>{t('dialog.password')}</Label>
            <Input
              type="Password"
              value={sapConfig.password}
              onInput={(e: any) => setSapConfig({ ...sapConfig, password: e.target.value })}
              style={{ width: '100%' }}
            />
          </FlexBox>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
            {t('dialog.note')}
          </p>
        </FlexBox>
      </Dialog>
    </div>
  );
};
