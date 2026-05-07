import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Toolbar as UI5Toolbar,
  Button,
  Search,
  Input,
  ToolbarSpacer,
  ToolbarSeparator,
  FlexBox,
  FlexBoxAlignItems
} from '@ui5/webcomponents-react';
import "@ui5/webcomponents-icons/dist/search";
import "@ui5/webcomponents-icons/dist/excel-attachment";
import "@ui5/webcomponents-icons/dist/line-chart";
import "@ui5/webcomponents-icons/dist/sum";
import "@ui5/webcomponents-icons/dist/refresh";
import "@ui5/webcomponents-icons/dist/clear-filter";
import "@ui5/webcomponents-icons/dist/download-from-cloud";
import "@ui5/webcomponents-icons/dist/settings";

interface ToolbarProps {
  onSearch: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  onExport: () => void;
  onToggleCharts: () => void;
  onToggleTotals: () => void;
  onClearFilters: () => void;
  onFetchSAP: () => void;
  onShowSettings: () => void;
  onTopChange: (value: string) => void;
  onSkipChange: (value: string) => void;
  onApplyPaging: () => void;
  showCharts: boolean;
  showTotals: boolean;
  searchValue: string;
  topValue: string;
  skipValue: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onSearch,
  onSearchSubmit,
  onExport,
  onToggleCharts,
  onToggleTotals,
  onClearFilters,
  onFetchSAP,
  onShowSettings,
  onTopChange,
  onSkipChange,
  onApplyPaging,
  showCharts,
  showTotals,
  searchValue,
  topValue,
  skipValue
}) => {
  const { t, i18n } = useTranslation();
  if (import.meta.env.DEV) console.log("Current language:", i18n.language);
  const topHasError = topValue.trim() !== "" && !/^\d+$/.test(topValue.trim());
  const skipHasError = skipValue.trim() !== "" && !/^\d+$/.test(skipValue.trim());

  const handleTopInput = (e: any) => {
    const next = String(e.target.value ?? "");
    if (/^\d*$/.test(next)) onTopChange(next);
  };

  const handleSkipInput = (e: any) => {
    const next = String(e.target.value ?? "");
    if (/^\d*$/.test(next)) onSkipChange(next);
  };

  const handlePagingKeyDown = (e: any) => {
    if (e.key === 'Enter' && !topHasError && !skipHasError) {
      onApplyPaging();
    }
  };

  return (
    <UI5Toolbar style={{ borderRadius: '4px 4px 0 0', flexWrap: 'wrap', height: 'auto', padding: '5px' }}>
      <Search 
        placeholder={t('toolbar.searchPlaceholder')} 
        value={searchValue}
        onInput={(e: any) => onSearch(e.target.value)}
        onSearch={(e: any) => onSearchSubmit(e.target.value)}
        style={{ width: '100%', minWidth: '200px', maxWidth: '400px', flex: '1 1 auto' }}
      />
      
      <ToolbarSpacer />

      <FlexBox alignItems={FlexBoxAlignItems.Center} style={{ gap: '4px', flexWrap: 'wrap' }}>
        <Button 
          icon="download-from-cloud" 
          design="Emphasized"
          onClick={onFetchSAP}
          tooltip={t('toolbar.fetchTooltip')}
        >
          <span className="mobile-hide">{t('toolbar.getOdata')}</span>
        </Button>

        <Button 
          icon="settings" 
          design="Transparent"
          onClick={onShowSettings}
          tooltip={t('toolbar.settingsTooltip')}
        >
          <span className="mobile-hide">{t('toolbar.loginSap')}</span>
        </Button>

        <ToolbarSeparator />

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Button 
            design={i18n.language.startsWith('tr') ? "Emphasized" : "Transparent"} 
            onClick={() => i18n.changeLanguage('tr')}
            style={{ minWidth: '40px' }}
          >
            TR
          </Button>
          <Button 
            design={i18n.language.startsWith('en') ? "Emphasized" : "Transparent"} 
            onClick={() => i18n.changeLanguage('en')}
            style={{ minWidth: '40px' }}
          >
            EN
          </Button>
          <Button 
            design={i18n.language.startsWith('de') ? "Emphasized" : "Transparent"} 
            onClick={() => i18n.changeLanguage('de')}
            style={{ minWidth: '40px' }}
          >
            DE
          </Button>
        </div>

        <ToolbarSeparator className="mobile-hide" />

        <Input
          value={topValue}
          onInput={handleTopInput}
          onKeyDown={handlePagingKeyDown}
          placeholder={t('toolbar.topPlaceholder')}
          type="Number"
          valueState={topHasError ? "Error" : "None"}
          style={{ width: '110px' }}
          tooltip={t('toolbar.topTooltip')}
        />
        <Input
          value={skipValue}
          onInput={handleSkipInput}
          onKeyDown={handlePagingKeyDown}
          placeholder={t('toolbar.skipPlaceholder')}
          type="Number"
          valueState={skipHasError ? "Error" : "None"}
          style={{ width: '110px' }}
          tooltip={t('toolbar.skipTooltip')}
        />
        <Button
          icon="refresh"
          design="Transparent"
          onClick={onApplyPaging}
          disabled={topHasError || skipHasError}
          tooltip={t('toolbar.applyPagingTooltip')}
        />

        <ToolbarSeparator />

        <Button 
          icon="sum" 
          design={showTotals ? "Emphasized" : "Transparent"}
          onClick={onToggleTotals}
          tooltip={t('toolbar.totalsTooltip')}
          className="mobile-hide"
        >
          {t('toolbar.totals')}
        </Button>
        
        <Button 
          icon="line-chart" 
          design={showCharts ? "Emphasized" : "Transparent"}
          onClick={onToggleCharts}
          tooltip={t('toolbar.chartsTooltip')}
          className="mobile-hide"
        >
          {t('toolbar.charts')}
        </Button>
        
        <ToolbarSeparator />
        
        <Button 
          icon="excel-attachment" 
          design="Transparent" 
          onClick={onExport}
          tooltip={t('toolbar.excelTooltip')}
        />
        
        <Button 
          icon="clear-filter" 
          design="Transparent" 
          onClick={onClearFilters}
          tooltip={t('toolbar.clearTooltip')}
        />
      </FlexBox>
    </UI5Toolbar>
  );
};
