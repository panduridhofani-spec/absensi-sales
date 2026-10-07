import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SalesList from './pages/SalesList';
import SalesProfile from './pages/SalesProfile';
import SalesTransactions from './pages/SalesTransactions';
import SalesAttendance from './pages/SalesAttendance';
import Attendance from './pages/Attendance';
import AllTransactions from './pages/AllTransactions';

import Notifications from './pages/Notifications';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="all-transactions" element={<AllTransactions />} />
          <Route path="sales" element={<SalesList />} />
          <Route path="sales/:id" element={<SalesProfile />} />
          <Route path="sales/:id/transactions" element={<SalesTransactions />} />
          <Route path="sales/:id/attendance" element={<SalesAttendance />} />
          <Route path="attendance" element={<Attendance />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
