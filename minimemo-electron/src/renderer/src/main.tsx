import React from 'react'
import ReactDOM from 'react-dom/client'
import { ColorSchemeScript } from '@mantine/core'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorSchemeScript defaultColorScheme="light" localStorageKey="minimemo-color-scheme" />
    <App />
  </React.StrictMode>
)
