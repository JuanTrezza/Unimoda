import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/inter'
import './index.css'
import { App } from './App'
import { handleAuthRedirect } from './lib/authRedirect'
import { listenToSession } from './store/session'

listenToSession()

// Si venimos de un link de email (?auth=…&code=…), primero se canjea el código y se pasa a la
// ruta con hash; después se monta el router. En una visita normal no espera nada.
handleAuthRedirect()
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
