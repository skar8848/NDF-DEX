import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Web3Provider } from './providers/Web3Provider'
import { Header } from './components/layout/Header'
import { NetworkGuard } from './components/layout/NetworkGuard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Landing } from './pages/Landing'

const Trade = lazy(() => import('./pages/Trade'))
const Markets = lazy(() =>
  import('./pages/Markets').then((m) => ({ default: m.Markets }))
)
const Portfolio = lazy(() =>
  import('./pages/Portfolio').then((m) => ({ default: m.Portfolio }))
)

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-56px)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-text-secondary text-sm">Loading...</span>
      </div>
    </div>
  )
}

function AppLayout() {
  return (
    <>
      <Header />
      <NetworkGuard>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </NetworkGuard>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Web3Provider>
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route element={<AppLayout />}>
                <Route path="/trade/:marketId" element={<Trade />} />
                <Route path="/markets" element={<Markets />} />
                <Route path="/portfolio" element={<Portfolio />} />
              </Route>
            </Routes>
            <Toaster
              theme="dark"
              position="bottom-right"
              richColors
              toastOptions={{
                style: {
                  background: '#12121a',
                  border: '1px solid #2a2a3e',
                  color: '#e4e4ed',
                },
              }}
            />
          </div>
        </BrowserRouter>
      </Web3Provider>
    </ErrorBoundary>
  )
}

export default App
