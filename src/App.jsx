import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SalesList from './pages/SalesList';
import SalesProfile from './pages/SalesProfile';
import SalesAttendance from './pages/SalesAttendance';
import Attendance from './pages/Attendance';
import Returns from './pages/Returns';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import { AuthProvider } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeedbackProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="returns" element={<Returns />} />
              <Route path="sales" element={<SalesList />} />
              <Route path="sales/:id" element={<SalesProfile />} />
              <Route path="sales/:id/attendance" element={<SalesAttendance />} />
              <Route path="attendance" element={<Attendance />} />
              {/* Rute transaksi lama kini digantikan halaman Retur global */}
              <Route path="all-transactions" element={<Navigate to="/returns" replace />} />
              <Route path="sales/:id/transactions" element={<Navigate to="/returns" replace />} />
            </Route>
            <Route element={<ProtectedRoute ownerOnly />}>
              <Route path="/" element={<Layout />}>
                <Route path="users" element={<UserManagement />} />
              </Route>
            </Route>
          </Route>
        </Routes>
        </FeedbackProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
