import { useTranslation } from 'react-i18next';
import { OdataGrid } from './components/OdataGrid/OdataGrid';
import './App.css';

function App() {
  const { t } = useTranslation();

  return (
    <div className="app-container">
      <h1 className="app-title">
        {t('app.title')}
      </h1>
      <div className="grid-container">
        <OdataGrid rowData={[]} columnDefs={[]} title="Satis_Raporu" />
      </div>
    </div>
  );
}

export default App;
