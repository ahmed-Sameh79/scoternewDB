import React from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import WarehousesPage from "@/pages/WarehousesPage";
import PartsPage from "@/pages/PartsPage";
import CategoriesPage from "@/pages/CategoriesPage";
import SubCategoriesPage from "@/pages/SubCategoriesPage";
import MotorcyclesPage from "@/pages/MotorcyclesPage";
import MotorcycleCategoriesPage from "@/pages/MotorcycleCategoriesPage";
import MotorcycleSubcategoriesPage from "@/pages/MotorcycleSubcategoriesPage";
import MotorcycleBrandsPage from "@/pages/MotorcycleBrandsPage";
import VendorsPage from "@/pages/VendorsPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import GRNPage from "@/pages/GRNPage";
import WorkOrdersPage from "@/pages/WorkOrdersPage";
import POSPage from "@/pages/POSPage";
import InvoicesPage from "@/pages/InvoicesPage";
import ReturnsPage from "@/pages/ReturnsPage";
import InspectionsPage from "@/pages/InspectionsPage";
import UsersPage from "@/pages/UsersPage";
import AuditPage from "@/pages/AuditPage";
import SettingsPage from "@/pages/SettingsPage";
import WebsiteCMSPage from "@/pages/WebsiteCMSPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType, roles?: string[] }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      
      <Route path="/warehouses">
        <ProtectedRoute component={WarehousesPage} roles={["admin", "storekeeper"]} />
      </Route>
      
      <Route path="/categories">
        <ProtectedRoute component={CategoriesPage} roles={["admin", "storekeeper"]} />
      </Route>

      <Route path="/subcategories">
        <ProtectedRoute component={SubCategoriesPage} roles={["admin", "storekeeper"]} />
      </Route>

      <Route path="/parts">
        <ProtectedRoute component={PartsPage} roles={["admin", "storekeeper"]} />
      </Route>
      
      <Route path="/motorcycle-categories">
        <ProtectedRoute component={MotorcycleCategoriesPage} roles={["admin", "sales"]} />
      </Route>

      <Route path="/motorcycle-subcategories">
        <ProtectedRoute component={MotorcycleSubcategoriesPage} roles={["admin", "sales"]} />
      </Route>

      <Route path="/motorcycle-brands">
        <ProtectedRoute component={MotorcycleBrandsPage} roles={["admin", "sales"]} />
      </Route>

      <Route path="/motorcycles">
        <ProtectedRoute component={MotorcyclesPage} roles={["admin", "sales"]} />
      </Route>
      
      <Route path="/vendors">
        <ProtectedRoute component={VendorsPage} roles={["admin", "storekeeper"]} />
      </Route>
      
      <Route path="/purchase-orders">
        <ProtectedRoute component={PurchaseOrdersPage} roles={["admin", "storekeeper"]} />
      </Route>
      
      <Route path="/grn">
        <ProtectedRoute component={GRNPage} roles={["admin", "storekeeper"]} />
      </Route>
      
      <Route path="/work-orders">
        <ProtectedRoute component={WorkOrdersPage} roles={["admin", "technician"]} />
      </Route>
      
      <Route path="/pos">
        <ProtectedRoute component={POSPage} roles={["admin", "sales"]} />
      </Route>
      
      <Route path="/invoices">
        <ProtectedRoute component={InvoicesPage} roles={["admin", "sales"]} />
      </Route>
      
      <Route path="/returns">
        <ProtectedRoute component={ReturnsPage} roles={["admin", "sales"]} />
      </Route>
      
      <Route path="/inspections">
        <ProtectedRoute component={InspectionsPage} roles={["admin", "technician"]} />
      </Route>
      
      <Route path="/users">
        <ProtectedRoute component={UsersPage} roles={["admin"]} />
      </Route>
      
      <Route path="/audit">
        <ProtectedRoute component={AuditPage} roles={["admin"]} />
      </Route>

      <Route path="/website-cms">
        <ProtectedRoute component={WebsiteCMSPage} roles={["admin"]} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
