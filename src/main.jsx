import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './store.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { ConfirmProvider } from './components/ConfirmDialog.jsx'
import DeviceGate from './components/DeviceGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <ConfirmProvider>
          <DeviceGate>
            <App />
          </DeviceGate>
        </ConfirmProvider>
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
)
