import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  createAppError, 
  getUserFriendlyMessage, 
  ErrorType, 
  classifyError,
  logError
} from '@/lib/error-handling'
import { validateData, validationSchemas } from '@/lib/validation'

/**
 * Feature: premier-league-prediction-game, Property 13: Error Message Generation
 * **Validates: Requirements 8.5**
 */

describe('Error Message Generation', () => {
  // Generators for different types of errors
  const errorTypeArbitrary = fc.constantFrom(
    ErrorType.NETWORK,
    ErrorType.DATABASE,
    ErrorType.AUTHENTICATION,
    ErrorType.VALIDATION,
    ErrorType.API_RATE_LIMIT,
    ErrorType.UNKNOWN
  )

  const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
  const errorCodeArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined })
  const statusCodeArbitrary = fc.integer({ min: 400, max: 599 })

  it('Property 13a: For any error condition, the system should generate user-friendly error messages with appropriate context', () => {
    fc.assert(
      fc.property(
        errorTypeArbitrary,
        errorMessageArbitrary,
        errorCodeArbitrary,
        statusCodeArbitrary,
        (errorType, message, code, statusCode) => {
          const appError = createAppError(message, errorType, {
            code,
            statusCode,
            retryable: true
          })

          // Error should have all required properties
          expect(appError.type).toBe(errorType)
          expect(appError.message).toBe(message)
          expect(appError.code).toBe(code)
          expect(appError.statusCode).toBe(statusCode)
          expect(appError.retryable).toBe(true)
          
          // User message should be user-friendly (not technical)
          expect(appError.userMessage).toBeDefined()
          expect(appError.userMessage.length).toBeGreaterThan(0)
          
          // User message should not contain technical details
          expect(appError.userMessage).not.toContain('Error:')
          expect(appError.userMessage).not.toContain('Exception:')
          expect(appError.userMessage).not.toContain('null')
          expect(appError.userMessage).not.toContain('undefined')
          
          // User message should be different from technical message for most cases
          if (errorType !== ErrorType.VALIDATION) {
            expect(appError.userMessage).not.toBe(message)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13b: Error messages should be consistent for the same error type', () => {
    fc.assert(
      fc.property(
        errorTypeArbitrary,
        (errorType) => {
          const message1 = getUserFriendlyMessage(errorType)
          const message2 = getUserFriendlyMessage(errorType)
          
          // Same error type should always produce the same user message
          expect(message1).toBe(message2)
          
          // Message should be appropriate for the error type
          switch (errorType) {
            case ErrorType.NETWORK:
              expect(message1.toLowerCase()).toMatch(/connect|network|internet/)
              break
            case ErrorType.DATABASE:
              expect(message1.toLowerCase()).toMatch(/data|save|try again/)
              break
            case ErrorType.AUTHENTICATION:
              expect(message1.toLowerCase()).toMatch(/sign|session|expired/)
              break
            case ErrorType.VALIDATION:
              expect(message1.toLowerCase()).toMatch(/input|check/)
              break
            case ErrorType.API_RATE_LIMIT:
              expect(message1.toLowerCase()).toMatch(/many|wait|moment/)
              break
            case ErrorType.UNKNOWN:
              expect(message1.toLowerCase()).toMatch(/wrong|try again|support/)
              break
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('Property 13c: Error classification should be consistent and appropriate', () => {
    fc.assert(
      fc.property(
        errorTypeArbitrary,
        errorMessageArbitrary,
        (errorType, message) => {
          const appError = createAppError(message, errorType)
          const classification = classifyError(appError)
          
          // Classification should match the error type
          expect(classification.type).toBe(errorType)
          
          // Severity should be appropriate for error type
          switch (errorType) {
            case ErrorType.VALIDATION:
              expect(classification.severity).toBe('low')
              expect(classification.shouldLog).toBe(false)
              expect(classification.shouldAlert).toBe(false)
              break
            case ErrorType.AUTHENTICATION:
            case ErrorType.NETWORK:
            case ErrorType.API_RATE_LIMIT:
              expect(classification.severity).toBe('medium')
              expect(classification.shouldLog).toBe(true)
              expect(classification.shouldAlert).toBe(false)
              break
            case ErrorType.DATABASE:
              expect(classification.severity).toBe('high')
              expect(classification.shouldLog).toBe(true)
              expect(classification.shouldAlert).toBe(true)
              break
            case ErrorType.UNKNOWN:
              expect(classification.severity).toBe('critical')
              expect(classification.shouldLog).toBe(true)
              expect(classification.shouldAlert).toBe(true)
              break
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13d: Validation errors should provide specific, actionable feedback', () => {
    // Test user validation errors
    fc.assert(
      fc.property(
        fc.record({
          email: fc.option(fc.string(), { nil: undefined }),
          name: fc.option(fc.string(), { nil: undefined }),
          avatar_url: fc.option(fc.string(), { nil: undefined })
        }),
        (userData) => {
          const result = validateData(userData, validationSchemas.user)
          
          if (!result.isValid) {
            // Each error should be specific and actionable
            for (const error of result.errors) {
              expect(error.length).toBeGreaterThan(0)
              
              // Should mention the field name
              expect(error).toMatch(/email|name|avatar_url/)
              
              // Should be actionable (tell user what to do)
              expect(error).toMatch(/required|must be|should be|invalid|format/)
              
              // Should not contain technical jargon
              expect(error).not.toContain('null')
              expect(error).not.toContain('undefined')
              expect(error).not.toContain('regex')
              expect(error).not.toContain('validation')
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13e: Prediction validation errors should be clear and helpful', () => {
    fc.assert(
      fc.property(
        fc.record({
          user_id: fc.option(fc.string(), { nil: undefined }),
          match_id: fc.option(fc.string(), { nil: undefined }),
          predicted_home_score: fc.option(fc.integer(), { nil: undefined }),
          predicted_away_score: fc.option(fc.integer(), { nil: undefined })
        }),
        (predictionData) => {
          const result = validateData(predictionData, validationSchemas.prediction)
          
          if (!result.isValid) {
            for (const error of result.errors) {
              expect(error.length).toBeGreaterThan(0)
              
              // Should be user-friendly
              if (error.includes('user_id') || error.includes('match_id')) {
                expect(error).toMatch(/required|must be|UUID/)
              }
              
              if (error.includes('score')) {
                expect(error).toMatch(/between 0 and 20|required|number|must be at least/)
              }
              
              // Should not expose internal field names in a confusing way
              if (error.includes('predicted_home_score')) {
                expect(error.toLowerCase()).toMatch(/home.*score|score.*home|predicted_home_score/)
              }
              
              if (error.includes('predicted_away_score')) {
                expect(error.toLowerCase()).toMatch(/away.*score|score.*away|predicted_away_score/)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13f: Error messages should be safe from XSS and injection attacks', () => {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      "'; DROP TABLE users; --",
      '${process.env.SECRET}',
      '{{constructor.constructor("return process")().env}}',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '<svg onload=alert(1)>'
    ]

    fc.assert(
      fc.property(
        fc.constantFrom(...maliciousInputs),
        errorTypeArbitrary,
        (maliciousInput, errorType) => {
          const appError = createAppError(maliciousInput, errorType)
          
          // User message should not contain the malicious input directly
          expect(appError.userMessage).not.toContain('<script>')
          expect(appError.userMessage).not.toContain('javascript:')
          expect(appError.userMessage).not.toContain('DROP TABLE')
          expect(appError.userMessage).not.toContain('process.env')
          expect(appError.userMessage).not.toContain('constructor')
          expect(appError.userMessage).not.toContain('onerror=')
          expect(appError.userMessage).not.toContain('onload=')
          
          // Should use the standard user-friendly message instead
          const expectedMessage = getUserFriendlyMessage(errorType)
          expect(appError.userMessage).toBe(expectedMessage)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('Property 13g: Error context should be preserved for debugging while keeping user messages safe', () => {
    fc.assert(
      fc.property(
        errorMessageArbitrary,
        errorTypeArbitrary,
        fc.record({
          userId: fc.option(fc.string(), { nil: undefined }),
          operation: fc.option(fc.string(), { nil: undefined }),
          timestamp: fc.option(fc.date(), { nil: undefined })
        }),
        (message, errorType, context) => {
          const appError = createAppError(message, errorType)
          
          // Simulate logging with context
          let loggedContext: any = null
          const originalConsoleError = console.error
          console.error = (msg: string, contextData: any) => {
            loggedContext = contextData
          }
          
          try {
            logError(appError, context)
            
            // Context should be preserved for debugging
            if (loggedContext) {
              expect(loggedContext.context).toEqual(context)
              expect(loggedContext.type).toBe(errorType)
              expect(loggedContext.message).toBe(message)
            }
          } finally {
            console.error = originalConsoleError
          }
          
          // But user message should still be safe and friendly
          expect(appError.userMessage).toBe(getUserFriendlyMessage(errorType))
        }
      ),
      { numRuns: 50 }
    )
  })

  it('Property 13h: Error messages should be localization-ready', () => {
    fc.assert(
      fc.property(
        errorTypeArbitrary,
        (errorType) => {
          const message = getUserFriendlyMessage(errorType)
          
          // Messages should be complete sentences
          expect(message.trim()).toMatch(/[.!]$/)
          
          // Should start with capital letter
          expect(message.charAt(0)).toMatch(/[A-Z]/)
          
          // Should not contain placeholder text
          expect(message).not.toContain('TODO')
          expect(message).not.toContain('FIXME')
          expect(message).not.toContain('{{')
          expect(message).not.toContain('}}')
          
          // Should be reasonable length (not too short or too long)
          expect(message.length).toBeGreaterThan(10)
          expect(message.length).toBeLessThan(200)
          
          // Should not contain technical error codes
          expect(message).not.toMatch(/\b[A-Z]{2,}\d+\b/) // Like HTTP500, ERR123
          expect(message).not.toMatch(/\b\d{3,}\b/) // Like 500, 404
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13i: Retryable errors should include retry guidance', () => {
    fc.assert(
      fc.property(
        errorTypeArbitrary,
        errorMessageArbitrary,
        (errorType, message) => {
          const retryableError = createAppError(message, errorType, { retryable: true })
          const nonRetryableError = createAppError(message, errorType, { retryable: false })
          
          if (retryableError.retryable) {
            // Only certain error types should have retry guidance in their standard messages
            if (errorType === ErrorType.NETWORK || 
                errorType === ErrorType.DATABASE || 
                errorType === ErrorType.API_RATE_LIMIT || 
                errorType === ErrorType.UNKNOWN) {
              expect(retryableError.userMessage.toLowerCase()).toMatch(/try again|retry|wait|moment/)
            }
            
            // Validation errors with retryable flag should still suggest checking input
            if (errorType === ErrorType.VALIDATION) {
              expect(retryableError.userMessage.toLowerCase()).toMatch(/check|input|try again/)
            }
          }
          
          if (!nonRetryableError.retryable && errorType === ErrorType.VALIDATION) {
            // Non-retryable validation errors should suggest checking input
            expect(nonRetryableError.userMessage.toLowerCase()).toMatch(/check|input|correct/)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 13j: Error messages should maintain consistency across similar operations', () => {
    const operations = ['create', 'update', 'delete', 'fetch']
    const entities = ['user', 'prediction', 'match']
    
    fc.assert(
      fc.property(
        fc.constantFrom(...operations),
        fc.constantFrom(...entities),
        errorTypeArbitrary,
        (operation, entity, errorType) => {
          const message1 = `Failed to ${operation} ${entity}`
          const message2 = `Could not ${operation} ${entity}`
          
          const error1 = createAppError(message1, errorType)
          const error2 = createAppError(message2, errorType)
          
          // For validation errors, the user message may contain the original message
          if (errorType === ErrorType.VALIDATION) {
            // Both should be meaningful validation messages
            expect(error1.userMessage.length).toBeGreaterThan(0)
            expect(error2.userMessage.length).toBeGreaterThan(0)
          } else {
            // Different technical messages but same error type should produce same user message
            expect(error1.userMessage).toBe(error2.userMessage)
            
            // User message should be generic and not expose internal operation details
            expect(error1.userMessage).not.toContain(operation)
            expect(error1.userMessage).not.toContain(entity)
            expect(error1.userMessage).not.toContain('Failed to')
            expect(error1.userMessage).not.toContain('Could not')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})