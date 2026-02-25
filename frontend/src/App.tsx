import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Web3Provider } from './providers/Web3Provider'
import { Header } from './components/layout/Header'
import { NetworkGuard } from './components/layout/NetworkGuard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Landing } from './pages/Landing'
import { ThemeContext, useThemeProvider, useTheme } from './hooks/useTheme'

const Trade = lazy(() => import('./pages/Trade'))
const Markets = lazy(() =>
  import('./pages/Markets').then((m) => ({ default: m.Markets }))
)
const Portfolio = lazy(() =>
  import('./pages/Portfolio').then((m) => ({ default: m.Portfolio }))
)
const Vault = lazy(() =>
  import('./pages/Vault').then((m) => ({ default: m.Vault }))
)
const Docs = lazy(() =>
  import('./pages/Docs').then((m) => ({ default: m.Docs }))
)

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-text-secondary text-sm">Loading...</span>
      </div>
    </div>
  )
}

function AppLayout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 min-h-0 overflow-auto no-scrollbar">
        <NetworkGuard>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </NetworkGuard>
      </div>
    </div>
  )
}

function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      richColors
      toastOptions={{
        style: {
          background: theme === 'dark' ? '#0a0a0a' : '#ffffff',
          border: theme === 'dark' ? '1px solid #ffffff' : '1px solid #1a1a1a',
          color: theme === 'dark' ? '#ffffff' : '#111111',
          textAlign: 'center' as const,
        },
      }}
    />
  )
}

function App() {
  const themeValue = useThemeProvider()

  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={themeValue}>
        <Web3Provider>
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<AppLayout />}>
                  <Route path="/trade/:marketId" element={<Trade />} />
                  <Route path="/markets" element={<Markets />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/vault" element={<Vault />} />
                  <Route path="/docs" element={<Docs />} />
                </Route>
              </Routes>
              <ThemedToaster />
            </div>
          </BrowserRouter>
        </Web3Provider>
      </ThemeContext.Provider>
    </ErrorBoundary>
  )
}

export default App
