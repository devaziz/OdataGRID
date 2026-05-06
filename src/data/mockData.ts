export const mockData = [
  { id: 100, customer: "Apple Inc.", product: "iPhone 15 Pro", category: "Mobile", quantity: 50, price: 1200, currency: "USD", date: "2024-01-10", status: "Completed", plant: "PL01" },
  { id: 101, customer: "Apple Inc.", product: "MacBook Pro M3", category: "Computing", quantity: 20, price: 2500, currency: "USD", date: "2024-01-12", status: "Completed", plant: "PL01" },
  { id: 102, customer: "Samsung Electronics", product: "Galaxy S24 Ultra", category: "Mobile", quantity: 45, price: 1100, currency: "USD", date: "2024-01-15", status: "Pending", plant: "PL02" },
  { id: 103, customer: "Samsung Electronics", product: "Galaxy Tab S9", category: "Tablets", quantity: 30, price: 800, currency: "USD", date: "2024-01-18", status: "Shipped", plant: "PL02" },
  { id: 104, customer: "Google LLC", product: "Pixel 8 Pro", category: "Mobile", quantity: 25, price: 999, currency: "USD", date: "2024-01-20", status: "Completed", plant: "PL01" },
  { id: 105, customer: "Microsoft Corp.", product: "Surface Laptop 5", category: "Computing", quantity: 15, price: 1500, currency: "USD", date: "2024-01-22", status: "Pending", plant: "PL03" },
  { id: 106, customer: "Microsoft Corp.", product: "Xbox Series X", category: "Gaming", quantity: 60, price: 499, currency: "USD", date: "2024-01-25", status: "Completed", plant: "PL03" },
  { id: 107, customer: "Sony Corp.", product: "PlayStation 5", category: "Gaming", quantity: 80, price: 499, currency: "USD", date: "2024-01-28", status: "Shipped", plant: "PL02" },
  { id: 108, customer: "Dell Technologies", product: "XPS 15", category: "Computing", quantity: 12, price: 1800, currency: "USD", date: "2024-02-01", status: "Completed", plant: "PL01" },
  { id: 109, customer: "HP Inc.", product: "EliteBook 840", category: "Computing", quantity: 18, price: 1400, currency: "USD", date: "2024-02-03", status: "Pending", plant: "PL01" },
  { id: 110, customer: "Logitech", product: "MX Master 3S", category: "Accessories", quantity: 120, price: 99, currency: "USD", date: "2024-02-05", status: "Completed", plant: "PL02" },
];

export const columnDefs = [
  { field: "plant", headerName: "Plant", width: 100, minWidth: 80, rowGroup: true, hide: true },
  { field: "category", headerName: "Category", width: 130, minWidth: 100, rowGroup: true, hide: true },
  { field: "customer", headerName: "Customer", minWidth: 150, filter: 'agTextColumnFilter', sortable: true },
  { field: "product", headerName: "Product", minWidth: 150, filter: 'agTextColumnFilter', sortable: true },
  { 
    field: "quantity", 
    headerName: "Quantity", 
    width: 100,
    minWidth: 80,
    filter: "agNumberColumnFilter", 
    aggFunc: 'sum',
    valueFormatter: (params: any) => params.value ? Math.floor(params.value).toLocaleString() : '0'
  },
  { 
    field: "price", 
    headerName: "Unit Price", 
    width: 100,
    minWidth: 100,
    filter: "agNumberColumnFilter",
    valueFormatter: (params: any) => params.value ? `$${params.value.toLocaleString()}` : ''
  },
  {
    headerName: "Total Amount",
    colId: "totalAmount",
    width: 130,
    minWidth: 120,
    valueGetter: (params: any) => {
      if (params.node.rowPinned) return params.data?.totalAmount;
      return params.data ? params.data.price * params.data.quantity : null;
    },
    aggFunc: 'sum',
    filter: "agNumberColumnFilter",
    valueFormatter: (params: any) => params.value ? `$${params.value.toLocaleString()}` : '$0',
    cellStyle: { fontWeight: 'bold', color: '#0064d2' }
  },
  { field: "date", headerName: "Doc. Date", width: 120, minWidth: 100, filter: "agDateColumnFilter" },
  { field: "status", headerName: "Status", width: 110, minWidth: 90, filter: true },
];
