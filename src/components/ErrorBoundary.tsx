'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logError, classifyError, ErrorType } from '@/lib/error-handling'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorId: string | null
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error with context
    logError(error, {
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'ErrorBoundary'
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Default error fallback component
 */
interface ErrorFallbackProps {
  error: Error | null
  errorId: string | null
  onRetry: () => void
}

function ErrorFallback({ error, errorId, onRetry }: ErrorFallbackProps) {
  const classification = classifyError(error)
  
  const getErrorMessage = () => {
    if (error && 'userMessage' in error) {
      return (error as any).userMessage
    }
    
    switch (classification.type) {
      case ErrorType.NETWORK:
        return 'Unable to connect to the server. Please check your internet connection.'
      case ErrorType.AUTHENTICATION:
        return 'Your session has expired. Please refresh the page and sign in again.'
      default:
        return 'Something went wrong. Please try refreshing the page.'
    }
  }

  const getErrorTitle = () => {
    switch (classification.severity) {
      case 'critical':
        return 'Critical Error'
      case 'high':
        return 'Service Error'
      case 'medium':
        return 'Connection Error'
      default:
        return 'Oops!'
    }
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200 p-6 text-center">
        <div className="mb-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {getErrorTitle()}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {getErrorMessage()}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onRetry}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
          >
            Refresh Page
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Error Details (Development)
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700 overflow-auto max-h-32">
              <div className="mb-2">
                <strong>Error ID:</strong> {errorId}
              </div>
              <div className="mb-2">
                <strong>Message:</strong> {error.message}
              </div>
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap">{error.stack}</pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Hook to handle async errors in functional components
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, context?: Record<string, any>) => {
    logError(error, context)
    
    // In a real app, you might want to show a toast notification
    // or update some global error state here
    console.error('Handled async error:', error)
  }, [])

  return handleError
}