import { Component, type ReactNode } from 'react'
import { ErrorState } from './ui/ErrorState'

/**
 * Última red si una página falla al renderizar o no se puede descargar su chunk (por ejemplo,
 * sin conexión o justo después de un deploy): mensaje amable y recarga, nunca pantalla en blanco.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="container-site py-10">
        <ErrorState what="esta página" onRetry={() => window.location.reload()} />
      </div>
    )
  }
}
