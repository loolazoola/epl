/**
 * Data validation and sanitization utilities
 * Ensures data integrity and prevents invalid data from entering the system
 */

import { createAppError, ErrorType } from './error-handling'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  sanitizedData?: any
}

/**
 * Validation schema for different data types
 */
export interface ValidationSchema {
  [key: string]: {
    required?: boolean
    type?: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'date'
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    custom?: (value: any) => boolean | string
  }
}

/**
 * Sanitize and validate input data against a schema
 */
export function validateData(data: any, schema: ValidationSchema): ValidationResult {
  const errors: string[] = []
  const sanitizedData: any = {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field]
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }
    
    // Skip validation for optional empty fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue
    }
    
    // Type validation and sanitization
    let sanitizedValue = value
    
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`)
          continue
        }
        sanitizedValue = value.trim()
        break
        
      case 'number':
        const numValue = Number(value)
        if (isNaN(numValue)) {
          errors.push(`${field} must be a valid number`)
          continue
        }
        sanitizedValue = numValue
        break
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`)
          continue
        }
        break
        
      case 'email':
        if (typeof value !== 'string' || !isValidEmail(value)) {
          errors.push(`${field} must be a valid email address`)
          continue
        }
        sanitizedValue = value.toLowerCase().trim()
        break
        
      case 'uuid':
        if (typeof value !== 'string' || !isValidUUID(value)) {
          errors.push(`${field} must be a valid UUID`)
          continue
        }
        break
        
      case 'date':
        const dateValue = new Date(value)
        if (isNaN(dateValue.getTime())) {
          errors.push(`${field} must be a valid date`)
          continue
        }
        sanitizedValue = dateValue.toISOString()
        break
    }
    
    // Range validation for numbers
    if (rules.type === 'number' && typeof sanitizedValue === 'number') {
      if (rules.min !== undefined && sanitizedValue < rules.min) {
        if (rules.max !== undefined) {
          errors.push(`${field} must be between ${rules.min} and ${rules.max}`)
        } else {
          errors.push(`${field} must be at least ${rules.min}`)
        }
        continue
      }
      if (rules.max !== undefined && sanitizedValue > rules.max) {
        if (rules.min !== undefined) {
          errors.push(`${field} must be between ${rules.min} and ${rules.max}`)
        } else {
          errors.push(`${field} must be at most ${rules.max}`)
        }
        continue
      }
    }
    
    // Length validation for strings
    if (rules.type === 'string' && typeof sanitizedValue === 'string') {
      if (rules.minLength !== undefined && sanitizedValue.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters long`)
        continue
      }
      if (rules.maxLength !== undefined && sanitizedValue.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters long`)
        continue
      }
    }
    
    // Pattern validation
    if (rules.pattern && typeof sanitizedValue === 'string') {
      if (!rules.pattern.test(sanitizedValue)) {
        errors.push(`${field} format is invalid`)
        continue
      }
    }
    
    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(sanitizedValue)
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${field} is invalid`)
        continue
      }
    }
    
    sanitizedData[field] = sanitizedValue
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined
  }
}

/**
 * Validation schemas for different entities
 */
export const validationSchemas = {
  user: {
    email: {
      required: true,
      type: 'email' as const,
      maxLength: 255
    },
    name: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 255,
      pattern: /^[a-zA-Z\s\-'\.]+$/
    },
    avatar_url: {
      required: false,
      type: 'string' as const,
      maxLength: 500,
      pattern: /^https?:\/\/.+/
    }
  },
  
  prediction: {
    user_id: {
      required: true,
      type: 'uuid' as const
    },
    match_id: {
      required: true,
      type: 'uuid' as const
    },
    predicted_home_score: {
      required: true,
      type: 'number' as const,
      min: 0,
      max: 20
    },
    predicted_away_score: {
      required: true,
      type: 'number' as const,
      min: 0,
      max: 20
    }
  },
  
  match: {
    external_id: {
      required: true,
      type: 'string' as const,
      maxLength: 50
    },
    home_team: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 255
    },
    away_team: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 255
    },
    home_score: {
      required: false,
      type: 'number' as const,
      min: 0,
      max: 20
    },
    away_score: {
      required: false,
      type: 'number' as const,
      min: 0,
      max: 20
    },
    status: {
      required: true,
      type: 'string' as const,
      custom: (value: string) => ['TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED'].includes(value)
    },
    kickoff_time: {
      required: true,
      type: 'date' as const
    },
    gameweek: {
      required: false,
      type: 'number' as const,
      min: 1,
      max: 38
    },
    season: {
      required: true,
      type: 'string' as const,
      pattern: /^\d{4}$/
    }
  }
}

/**
 * Validate user data
 */
export function validateUser(data: any): ValidationResult {
  return validateData(data, validationSchemas.user)
}

/**
 * Validate prediction data
 */
export function validatePrediction(data: any): ValidationResult {
  const result = validateData(data, validationSchemas.prediction)
  
  // Additional business logic validation
  if (result.isValid && result.sanitizedData) {
    // Check that home and away scores are different for more interesting predictions
    // (This is optional - users can predict draws)
    
    // Validate that the match hasn't started (this should be done at the service level)
    // but we can add a warning here
  }
  
  return result
}

/**
 * Validate match data
 */
export function validateMatch(data: any): ValidationResult {
  const result = validateData(data, validationSchemas.match)
  
  // Additional business logic validation
  if (result.isValid && result.sanitizedData) {
    const sanitized = result.sanitizedData
    
    // Validate that home and away teams are different
    if (sanitized.home_team === sanitized.away_team) {
      result.errors.push('Home team and away team must be different')
      result.isValid = false
    }
    
    // Validate that if one score is provided, both must be provided
    const hasHomeScore = sanitized.home_score !== undefined && sanitized.home_score !== null
    const hasAwayScore = sanitized.away_score !== undefined && sanitized.away_score !== null
    
    if (hasHomeScore !== hasAwayScore) {
      result.errors.push('Both home and away scores must be provided together')
      result.isValid = false
    }
    
    // Validate that finished matches have scores
    if (sanitized.status === 'FINISHED' && (!hasHomeScore || !hasAwayScore)) {
      result.errors.push('Finished matches must have both home and away scores')
      result.isValid = false
    }
    
    // Validate that non-finished matches don't have scores
    if (sanitized.status !== 'FINISHED' && (hasHomeScore || hasAwayScore)) {
      result.errors.push('Only finished matches should have scores')
      result.isValid = false
    }
  }
  
  return result
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Validate and throw error if validation fails
 */
export function validateOrThrow(data: any, schema: ValidationSchema, entityName: string): any {
  const result = validateData(data, schema)
  
  if (!result.isValid) {
    throw createAppError(
      `Invalid ${entityName} data: ${result.errors.join(', ')}`,
      ErrorType.VALIDATION,
      {
        retryable: false,
        userMessage: `Please check your ${entityName} information: ${result.errors.join(', ')}`
      }
    )
  }
  
  return result.sanitizedData
}

/**
 * Middleware function to validate API request bodies
 */
export function createValidationMiddleware(schema: ValidationSchema) {
  return (data: any) => {
    const result = validateData(data, schema)
    
    if (!result.isValid) {
      throw createAppError(
        `Validation failed: ${result.errors.join(', ')}`,
        ErrorType.VALIDATION,
        {
          retryable: false,
          userMessage: result.errors.join(', ')
        }
      )
    }
    
    return result.sanitizedData
  }
}

/**
 * Rate limiting validation
 */
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(identifier: string, config: RateLimitConfig): boolean {
  const now = Date.now()
  const existing = rateLimitStore.get(identifier)
  
  if (!existing || now > existing.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return true
  }
  
  if (existing.count >= config.maxRequests) {
    return false
  }
  
  existing.count++
  return true
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

// Clean up rate limit store every 5 minutes
if (typeof window === 'undefined') { // Server-side only
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}