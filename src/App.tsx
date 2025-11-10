import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/Dashboard';
import P2P from './pages/P2P';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Transactions from './pages/Transactions';
import Benefits from './pages/Benefits';
import UserGuide from './pages/UserGuide';
import AppealPage from './pages/AppealPage';
import SupportCallPage from './pages/SupportCallPage';
import OrderCallPage from './pages/OrderCallPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminAgents from './pages/admin/AdminAgents';
import AdminLocations from './pages/admin/AdminLocations';
import AdminSettings from './pages/admin/AdminSettings';
import AdminReviews from './pages/admin/AdminReviews';
import AdminVideos from './pages/admin/AdminVideos';
import AdminSupportCalls from './pages/admin/AdminSupportCalls';
import CallNotificationProvider from './providers/CallNotificationProvider';
import './utils/consoleDebugger';

// Wrapper component for main app routes with Layout
const MainLayoutWrapper = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
    <Layout>
      <Outlet />
    </Layout>
  </div>
);

// Wrapper component for admin routes with AdminLayout
const AdminLayoutWrapper = () => (
  <AdminLayout>
    <Outlet />
  </AdminLayout>
);

// Wrapper component for full-screen pages (no layout)
const FullScreenWrapper = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
    <Outlet />
  </div>
);

// Create router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayoutWrapper />,
    children: [
      {
        index: true,
        element: <Dashboard />
      },
      {
        path: 'p2p',
        element: <P2P />
      },
      {
        path: 'orders',
        element: <Orders />
      },
      {
        path: 'transactions',
        element: <Transactions />
      },
      {
        path: 'profile',
        element: <Profile />
      },
      {
        path: 'guide',
        element: <UserGuide />
      },
      {
        path: 'how-to-use',
        element: <UserGuide />
      },
      {
        path: 'benefits',
        element: <Benefits />
      }
    ]
  },
  {
    path: '/',
    element: <FullScreenWrapper />,
    children: [
      {
        path: 'orders/appeal/:walletAddress/:orderId',
        element: <AppealPage />
      },
      {
        path: 'orders/:orderId/appeal',
        element: <AppealPage />
      },
      {
        path: 'appeal/:walletAddress/:orderId',
        element: <AppealPage />
      },
      {
        path: 'orders/orders/appeal/:walletAddress/:orderId',
        element: <AppealPage />
      }
    ]
  },
  // Unwrapped routes: no Layout/Admin wrappers to avoid wallet dependency
  {
    path: 'support-call/:walletAddress',
    element: <SupportCallPage />
  },
  {
    path: 'support-call',
    element: <SupportCallPage />
  },
  {
    path: 'call/:orderId/:walletAddress',
    element: <OrderCallPage />
  },
  {
    path: '/admin',
    children: [
      {
        path: 'login',
        element: <AdminLogin />
      },
      {
        element: <AdminLayoutWrapper />,
        children: [
          {
            index: true,
            element: <AdminDashboard />
          },
          {
            path: 'orders',
            element: <AdminOrders />
          },
          {
            path: 'transactions',
            element: <AdminTransactions />
          },
          {
            path: 'disputes',
            element: <AdminDisputes />
          },
          {
            path: 'support-calls',
            element: <AdminSupportCalls />
          },
          {
            path: 'agents',
            element: <AdminAgents />
          },
          {
            path: 'locations',
            element: <AdminLocations />
          },
          {
            path: 'reviews',
            element: <AdminReviews />
          },
          {
            path: 'videos',
            element: <AdminVideos />
          },
          {
            path: 'settings',
            element: <AdminSettings />
          }
        ]
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);

function App() {
  return (
    <CallNotificationProvider>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </CallNotificationProvider>
  );
}

export default App;
