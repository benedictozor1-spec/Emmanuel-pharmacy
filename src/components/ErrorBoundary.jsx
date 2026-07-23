import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Emmanuel Pharmacy ErrorBoundary caught an exception:', error, errorInfo)
  }

  handleReset = () => {
    try {
      localStorage.removeItem('ep_staff_profile')
    } catch (e) {}
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F4EE',
          fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
          padding: '24px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '36px 32px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
            border: '1px solid #E7E1D2',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#EEF2FE',
              color: '#1F45B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 20px'
            }}>
              💊
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1C1B18', margin: '0 0 8px' }}>
              Emmanuel Pharmacy System
            </h2>
            <p style={{ fontSize: '13px', color: '#86816F', margin: '0 0 24px', lineHeight: 1.5 }}>
              The application encountered a temporary display issue. Click below to refresh and resume seamlessly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  height: '46px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #245DE2, #1F45B8)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(31,69,184,0.25)'
                }}
              >
                ↻ Refresh Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  height: '42px',
                  borderRadius: '12px',
                  border: '1.5px solid #E7E1D2',
                  background: '#FFFFFF',
                  color: '#86816F',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Reset Session & Go to Login
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
