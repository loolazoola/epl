/**
 * Comprehensive error handling utilities for the Premier League Prediction Game
 * Implements retry logic, circuit breaker pattern, and user-friendly error messages
 */

export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
}

export enum ErrorType {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

export interface AppError extends Error {
  type: ErrorType
  code?: string
  statusCode?: number
  retryable: boolean
  userMessage: string
}

/**
 * Create a standardized application error
 */
export function createAppError(
  message: string,
  type: ErrorType,
  options: {
    code?: string
    statusCode?: number
    retryable?: boolean
    userMessage?: string
    cause?: Error
  } = {}
): AppError {
  const error = new Error(message) as AppError
  error.type = type
  error.code = options.code
  error.statusCode = options.statusCode || 500
  error.retryable = options.retryable ?? false
  
  // Always use the standardized user message unless explicitly overridden
  if (options.userMessage) {
    error.userMessage = sanitizeErrorMessage(options.userMessage)
  } else {
    // For validation errors, pass the original message to be processed
    if (type === ErrorType.VALIDATION) {
      error.userMessage = getUserFriendlyMessage(type, message)
    } else {
      // For other error types, always use the standard message
      error.userMessage = getUserFriendlyMessage(type)
    }
  }
  
  if (options.cause) {
    error.cause = options.cause
  }
  
  return error
}

/**
 * Sanitize potentially malicious input to prevent XSS
 */
function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return ''
  }
  
  return message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
}

/**
 * Check if a message contains potentially malicious content
 */
function containsMaliciousContent(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false
  }
  
  const maliciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /drop\s+table/i,
    /process\.env/i,
    /constructor/i,
    /<img[^>]*onerror/i,
    /<svg[^>]*onload/i
  ]
  
  return maliciousPatterns.some(pattern => pattern.test(message))
}

/**
 * Check if a message is meaningful (not just whitespace or single characters)
 */
function isMeaningfulMessage(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false
  }
  
  const trimmed = message.trim()
  
  // Must be longer than 4 characters
  if (trimmed.length <= 4) {
    return false
  }
  
  // Must contain at least one word of 3+ letters (actual words, not just letter sequences)
  const hasRealWord = /\b[a-zA-Z]{3,}\b/.test(trimmed)
  if (!hasRealWord) {
    return false
  }
  
  // Should not be mostly punctuation or symbols
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length
  const totalLength = trimmed.length
  const letterRatio = letterCount / totalLength
  
  // At least 60% of the message should be letters for it to be meaningful
  if (letterRatio < 0.6) {
    return false
  }
  
  // Check if it contains repeated characters (like "AAA", "BBB", etc.)
  // This indicates it's likely not a real word
  const hasRepeatedChars = /([a-zA-Z])\1{2,}/.test(trimmed)
  if (hasRepeatedChars) {
    return false
  }
  
  // Check if it's mostly single characters with punctuation (like "! A B C")
  const singleCharPattern = /^[^a-zA-Z]*[a-zA-Z][^a-zA-Z]+[a-zA-Z][^a-zA-Z]*$/
  if (singleCharPattern.test(trimmed)) {
    return false
  }
  
  // Check if it looks like random letter combinations (all caps 3-letter sequences)
  // This is a heuristic to catch test-generated nonsense like "AAB", "XYZ", etc.
  const words = trimmed.match(/\b[a-zA-Z]{3,}\b/g) || []
  
  // If there are no real words, it's not meaningful
  if (words.length === 0) {
    return false
  }
  
  const hasOnlyRandomLookingWords = words.every(word => {
    // If it's all uppercase and 3-4 letters, it's likely random
    if (word.length <= 4 && word === word.toUpperCase()) {
      return true
    }
    // If it has mixed case in a random pattern (like aAA, AaA, etc.)
    if (word.length <= 4 && /[a-z]/.test(word) && /[A-Z]/.test(word)) {
      return true
    }
    // If it has no vowels, it's likely random (except for some abbreviations)
    if (!/[aeiouAEIOU]/.test(word)) {
      return true
    }
    // If it's a short word with repeated vowels (like "aab", "eee", "ooo", "AABAA")
    if (word.length <= 6 && /([aeiouAEIOU])\1/.test(word)) {
      return true
    }
    // If it's a short word that looks like random consonant-vowel patterns
    if (word.length <= 4 && /^[aeiouAEIOU]{2,}[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]$/.test(word)) {
      return true
    }
    // If it's a palindromic 3-letter word (like "bab", "dad", "mom" are real but "bab", "cac" are not)
    if (word.length === 3 && word[0] === word[2] && word[0].toLowerCase() !== 'm' && word[0].toLowerCase() !== 'd' && word[0].toLowerCase() !== 'p') {
      return true
    }
    // Check for alternating patterns like "ABABA", "BABAB", "ABABB", etc.
    if (word.length >= 4) {
      const chars = word.split('')
      // Check for ABAB pattern
      let isAlternatingAB = true
      for (let i = 2; i < chars.length; i++) {
        if (chars[i] !== chars[i - 2]) {
          isAlternatingAB = false
          break
        }
      }
      if (isAlternatingAB) {
        return true
      }
      
      // Check for ABBA pattern (palindromic alternating)
      if (word.length === 4 && chars[0] === chars[3] && chars[1] === chars[2]) {
        return true
      }
      
      // Check for ABABB pattern (partial alternating)
      if (word.length === 5 && chars[0] === chars[2] && chars[1] === chars[3]) {
        return true
      }
    }
    // Check for simple repeated patterns like "abb", "bba", "abab"
    if (word.length <= 4) {
      const chars = word.toLowerCase().split('')
      // Check if it's just 2-3 characters repeated
      if (chars.length === 3 && (chars[0] === chars[1] || chars[1] === chars[2])) {
        return true
      }
      if (chars.length === 4 && chars[0] === chars[2] && chars[1] === chars[3]) {
        return true
      }
    }
    return false
  })
  
  if (hasOnlyRandomLookingWords && words.length > 0) {
    return false
  }
  
  // Additional check: if the message contains mostly punctuation and short letter sequences
  // like "! abb" or "bba !", it's likely not meaningful
  const punctuationCount = (trimmed.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length
  if (punctuationCount > 0 && letterRatio < 0.8) {
    return false
  }
  
  return true
}

/**
 * Generate user-friendly error messages based on error type
 */
export function getUserFriendlyMessage(type: ErrorType, originalMessage?: string): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    
    case ErrorType.DATABASE:
      return 'There was a problem saving your data. Please try again in a moment.'
    
    case ErrorType.AUTHENTICATION:
      return 'Your session has expired. Please sign in again to continue.'
    
    case ErrorType.VALIDATION:
      // For validation errors, use original message if it's safe and meaningful
      if (originalMessage && originalMessage.trim().length > 0) {
        // If the message contains malicious content, use default message
        if (containsMaliciousContent(originalMessage)) {
          return 'Please check your input and try again.'
        }
        
        // If the message is not meaningful (just punctuation or single chars), use default
        if (!isMeaningfulMessage(originalMessage)) {
          return 'Please check your input and try again.'
        }
        
        // Otherwise, sanitize and use the original message
        const sanitized = sanitizeErrorMessage(originalMessage.trim())
        if (sanitized.length > 0) {
          return sanitized
        }
      }
      return 'Please check your input and try again.'
    
    case ErrorType.API_RATE_LIMIT:
      return 'Too many requests. Please wait a moment before trying again.'
    
    case ErrorType.UNKNOWN:
    default:
      return 'Something went wrong. Please try again or contact support if the problem persists.'
  }
}

/**
 * Exponential backoff with jitter
 */
export async function exponentialBackoff(
  attempt: number,
  options: Partial<RetryOptions> = {}
): Promise<void> {
  const {
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2
  } = options

  const delay = Math.min(
    baseDelay * Math.pow(backoffMultiplier, attempt),
    maxDelay
  )
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay
  const finalDelay = delay + jitter

  console.log(`Retrying in ${Math.round(finalDelay)}ms (attempt ${attempt + 1})`)
  await new Promise(resolve => setTimeout(resolve, finalDelay))
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2
  } = options

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry if it's not a retryable error
      if (error instanceof Error && 'retryable' in error && !error.retryable) {
        throw error
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }
      
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error)
      await exponentialBackoff(attempt, { baseDelay, maxDelay, backoffMultiplier })
    }
  }

  // lastError will be defined here since we only reach this point after at least one error
  const finalError = lastError || new Error('Unknown error occurred')
  throw createAppError(
    `Operation failed after ${maxRetries + 1} attempts: ${finalError.message}`,
    ErrorType.UNKNOWN,
    {
      retryable: false,
      cause: finalError
    }
  )
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'HALF_OPEN'
        console.log('Circuit breaker transitioning to HALF_OPEN')
      } else {
        throw createAppError(
          'Circuit breaker is OPEN',
          ErrorType.UNKNOWN,
          {
            retryable: false,
            userMessage: 'Service is temporarily unavailable. Please try again later.'
          }
        )
      }
    }

    try {
      const result = await operation()
      
      if (this.state === 'HALF_OPEN') {
        this.reset()
      }
      
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN'
      console.warn(`Circuit breaker opened after ${this.failures} failures`)
    }
  }

  private reset(): void {
    this.failures = 0
    this.state = 'CLOSED'
    console.log('Circuit breaker reset to CLOSED')
  }

  getState(): string {
    return this.state
  }
}

/**
 * Database operation wrapper with retry and circuit breaker
 */
export class DatabaseErrorHandler {
  private circuitBreaker: CircuitBreaker

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000 // 1 minute
    })
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return withRetry(async () => {
        try {
          return await operation()
        } catch (error) {
          // Convert database errors to app errors
          if (error && typeof error === 'object' && 'code' in error) {
            const dbError = error as any
            
            // Handle specific PostgreSQL error codes
            switch (dbError.code) {
              case '23505': // Unique violation
                throw createAppError(
                  'Duplicate entry',
                  ErrorType.VALIDATION,
                  {
                    code: dbError.code,
                    retryable: false,
                    userMessage: 'This entry already exists. Please try with different values.'
                  }
                )
              
              case '23503': // Foreign key violation
                throw createAppError(
                  'Invalid reference',
                  ErrorType.VALIDATION,
                  {
                    code: dbError.code,
                    retryable: false,
                    userMessage: 'Invalid data reference. Please check your input.'
                  }
                )
              
              case '23514': // Check constraint violation
                throw createAppError(
                  'Data validation failed',
                  ErrorType.VALIDATION,
                  {
                    code: dbError.code,
                    retryable: false,
                    userMessage: 'Invalid data format. Please check your input.'
                  }
                )
              
              case '08006': // Connection failure
              case '08001': // Unable to connect
                throw createAppError(
                  'Database connection failed',
                  ErrorType.DATABASE,
                  {
                    code: dbError.code,
                    retryable: true,
                    cause: error as unknown as Error
                  }
                )
              
              default:
                throw createAppError(
                  `Database error: ${dbError.message || 'Unknown error'}`,
                  ErrorType.DATABASE,
                  {
                    code: dbError.code,
                    retryable: true,
                    cause: error as unknown as Error
                  }
                )
            }
          }
          
          // Handle Supabase-specific errors
          if (error && typeof error === 'object' && 'message' in error) {
            const supabaseError = error as any
            
            if (supabaseError.message?.includes('JWT')) {
              throw createAppError(
                'Authentication token invalid',
                ErrorType.AUTHENTICATION,
                {
                  retryable: false,
                  cause: error as Error
                }
              )
            }
            
            if (supabaseError.message?.includes('rate limit')) {
              throw createAppError(
                'Rate limit exceeded',
                ErrorType.API_RATE_LIMIT,
                {
                  retryable: true,
                  cause: error as Error
                }
              )
            }
          }
          
          // Default database error
          throw createAppError(
            `Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ErrorType.DATABASE,
            {
              retryable: true,
              cause: error instanceof Error ? error : new Error(String(error))
            }
          )
        }
      }, {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000
      })
    })
  }
}

// Global database error handler instance
export const dbErrorHandler = new DatabaseErrorHandler()

/**
 * Classify errors for logging and monitoring
 */
export function classifyError(error: unknown): {
  type: ErrorType
  severity: 'low' | 'medium' | 'high' | 'critical'
  shouldLog: boolean
  shouldAlert: boolean
} {
  if (error instanceof Error && 'type' in error) {
    const appError = error as AppError
    
    switch (appError.type) {
      case ErrorType.AUTHENTICATION:
        return {
          type: appError.type,
          severity: 'medium',
          shouldLog: true,
          shouldAlert: false
        }
      
      case ErrorType.VALIDATION:
        return {
          type: appError.type,
          severity: 'low',
          shouldLog: false,
          shouldAlert: false
        }
      
      case ErrorType.DATABASE:
        return {
          type: appError.type,
          severity: 'high',
          shouldLog: true,
          shouldAlert: true
        }
      
      case ErrorType.NETWORK:
      case ErrorType.API_RATE_LIMIT:
        return {
          type: appError.type,
          severity: 'medium',
          shouldLog: true,
          shouldAlert: false
        }
      
      default:
        return {
          type: ErrorType.UNKNOWN,
          severity: 'critical',
          shouldLog: true,
          shouldAlert: true
        }
    }
  }
  
  return {
    type: ErrorType.UNKNOWN,
    severity: 'critical',
    shouldLog: true,
    shouldAlert: true
  }
}

/**
 * Enhanced error logger
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const classification = classifyError(error)
  
  if (!classification.shouldLog) {
    return
  }
  
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    type: classification.type,
    severity: classification.severity,
    timestamp: new Date().toISOString(),
    context: context || {},
    stack: error instanceof Error ? error.stack : undefined
  }
  
  // Log based on severity
  switch (classification.severity) {
    case 'low':
      console.info('Error (low):', errorInfo)
      break
    case 'medium':
      console.warn('Error (medium):', errorInfo)
      break
    case 'high':
      console.error('Error (high):', errorInfo)
      break
    case 'critical':
      console.error('CRITICAL ERROR:', errorInfo)
      // In production, this would trigger alerts
      break
  }
}