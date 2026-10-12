import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SellerProvider } from './context/SellerContext';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PaymentReturnPage } from './pages/PaymentReturnPage';
import { MainLayout } from './components/MainLayout';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Ссылка из письма: открывается и без входа, и поверх активной сессии */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Возврат из FreedomPay: грузится внутри попапа оплаты, без меню и входа */}
      <Route path="/payment/return" element={<PaymentReturnPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <SellerProvider>
              <MainLayout />
            </SellerProvider>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
