import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import Market from '@/pages/market';
import Predictions from '@/pages/predictions';
import Profiles from '@/pages/profiles';
import ProfileDetail from '@/pages/profile-detail';
import { Roles, RoleDetail } from '@/pages/roles';
import { AiSettings, Cohort, Courses, NotFound, Sdg } from '@/pages/misc';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, refetchOnWindowFocus: false } } });

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/market" component={Market} />
          <Route path="/predictions" component={Predictions} />
          <Route path="/profiles" component={Profiles} />
          <Route path="/profiles/:id" component={ProfileDetail} />
          <Route path="/roles" component={Roles} />
          <Route path="/roles/:id" component={RoleDetail} />
          <Route path="/courses" component={Courses} />
          <Route path="/cohort" component={Cohort} />
          <Route path="/sdg" component={Sdg} />
          <Route path="/settings/ai" component={AiSettings} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
