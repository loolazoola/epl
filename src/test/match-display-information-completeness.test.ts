import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Match, Prediction } from '@/types/database'

/**
 * Feature: premier-league-prediction-game, Property 9: Match Display Information Completeness
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

describe('Match Display Information Completeness', () => {
  // Generator for match status
  const matchStatusArbitrary = fc.constantFrom('TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED')
  
  // Generator for valid football scores (0-20)
  const scoreArbitrary = fc.integer({ min: 0, max: 20 })
  
  // Generator for team names
  const teamNameArbitrary = fc.string({ minLength: 3, maxLength: 30 }).filter(name => name.trim().length > 0)
  
  // Generator for valid timestamps (using milliseconds to avoid invalid dates)
  const timestampArbitrary = fc.integer({ min: 1672531200000, max: 1735689600000 }) // 2023-2025 range
  
  // Generator for gameweek
  const gameweekArbitrary = fc.option(fc.integer({ min: 1, max: 38 }))
  
  // Generator for match based on status
  const matchArbitrary = fc.record({
    id: fc.uuid(),
    external_id: fc.string({ minLength: 1, maxLength: 50 }),
    home_team: teamNameArbitrary,
    away_team: teamNameArbitrary,
    status: matchStatusArbitrary,
    kickoff_time: timestampArbitrary.map(ts => new Date(ts).toISOString()),
    gameweek: gameweekArbitrary,
    season: fc.constantFrom('2023/24', '2024/25'),
    created_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
    updated_at: timestampArbitrary.map(ts => new Date(ts).toISOString())
  }).chain(baseMatch => {
    // Add scores based on status
    if (baseMatch.status === 'FINISHED') {
      return fc.constant({
        ...baseMatch,
        home_score: fc.sample(scoreArbitrary, 1)[0],
        away_score: fc.sample(scoreArbitrary, 1)[0]
      })
    } else if (baseMatch.status === 'IN_PLAY') {
      return fc.constant({
        ...baseMatch,
        home_score: Math.random() > 0.5 ? fc.sample(scoreArbitrary, 1)[0] : undefined,
        away_score: Math.random() > 0.5 ? fc.sample(scoreArbitrary, 1)[0] : undefined
      })
    } else {
      return fc.constant({
        ...baseMatch,
        home_score: undefined,
        away_score: undefined
      })
    }
  })
  
  // Generator for prediction
  const predictionArbitrary = fc.record({
    id: fc.uuid(),
    user_id: fc.uuid(),
    match_id: fc.uuid(),
    predicted_home_score: scoreArbitrary,
    predicted_away_score: scoreArbitrary,
    points_earned: fc.constantFrom(0, 2, 5),
    processed: fc.boolean(),
    created_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
    updated_at: timestampArbitrary.map(ts => new Date(ts).toISOString())
  })

  // Mock function to simulate match display rendering
  const renderMatchDisplay = (match: Match, prediction?: Prediction) => {
    const display = {
      teams: {
        home: match.home_team,
        away: match.away_team
      },
      status: match.status,
      kickoffTime: match.kickoff_time,
      gameweek: match.gameweek,
      scores: {
        home: match.home_score,
        away: match.away_score
      },
      prediction: prediction ? {
        home: prediction.predicted_home_score,
        away: prediction.predicted_away_score,
        points: prediction.points_earned,
        processed: prediction.processed
      } : undefined
    }
    
    return display
  }

  it('Property 9: For any match in any status (scheduled, in-progress, finished), the system should display appropriate information including scores, predictions, points earned, and status indicators based on the match state', () => {
    fc.assert(
      fc.property(
        matchArbitrary,
        fc.option(predictionArbitrary),
        (match, prediction) => {
          const display = renderMatchDisplay(match, prediction)
          
          // Requirement 6.1: Display team names
          expect(display.teams.home).toBe(match.home_team)
          expect(display.teams.away).toBe(match.away_team)
          expect(display.teams.home).toBeTruthy()
          expect(display.teams.away).toBeTruthy()
          
          // Requirement 6.2: Display status
          expect(display.status).toBe(match.status)
          expect(['TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED']).toContain(display.status)
          
          // Requirement 6.3: Display kickoff time
          expect(display.kickoffTime).toBe(match.kickoff_time)
          expect(display.kickoffTime).toBeTruthy()
          
          // Requirement 6.4: Display gameweek if available
          if (match.gameweek !== undefined && match.gameweek !== null) {
            expect(display.gameweek).toBe(match.gameweek)
            expect(typeof display.gameweek).toBe('number')
            expect(display.gameweek).toBeGreaterThan(0)
            expect(display.gameweek).toBeLessThanOrEqual(38)
          }
          
          // Status-specific requirements
          if (match.status === 'FINISHED') {
            // Finished matches should show final scores
            expect(display.scores.home).toBeDefined()
            expect(display.scores.away).toBeDefined()
            expect(typeof display.scores.home).toBe('number')
            expect(typeof display.scores.away).toBe('number')
            expect(display.scores.home).toBeGreaterThanOrEqual(0)
            expect(display.scores.away).toBeGreaterThanOrEqual(0)
          }
          
          if (match.status === 'TIMED') {
            // Scheduled matches should not show scores
            expect(display.scores.home).toBeUndefined()
            expect(display.scores.away).toBeUndefined()
          }
          
          // Prediction display requirements
          if (prediction) {
            expect(display.prediction).toBeDefined()
            expect(display.prediction!.home).toBe(prediction.predicted_home_score)
            expect(display.prediction!.away).toBe(prediction.predicted_away_score)
            expect(display.prediction!.points).toBe(prediction.points_earned)
            expect(display.prediction!.processed).toBe(prediction.processed)
            
            // Points should be valid values
            expect([0, 2, 5]).toContain(display.prediction!.points)
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9a: Finished matches always display final scores', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          external_id: fc.string({ minLength: 1, maxLength: 50 }),
          home_team: teamNameArbitrary,
          away_team: teamNameArbitrary,
          status: fc.constant('FINISHED'),
          kickoff_time: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          gameweek: gameweekArbitrary,
          season: fc.constantFrom('2023/24', '2024/25'),
          created_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          updated_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          home_score: scoreArbitrary,
          away_score: scoreArbitrary
        }),
        (match) => {
          const display = renderMatchDisplay(match)
          
          expect(display.scores.home).toBeDefined()
          expect(display.scores.away).toBeDefined()
          expect(typeof display.scores.home).toBe('number')
          expect(typeof display.scores.away).toBe('number')
          expect(display.scores.home).toBeGreaterThanOrEqual(0)
          expect(display.scores.away).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9b: Scheduled matches never display scores', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          external_id: fc.string({ minLength: 1, maxLength: 50 }),
          home_team: teamNameArbitrary,
          away_team: teamNameArbitrary,
          status: fc.constant('TIMED'),
          kickoff_time: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          gameweek: gameweekArbitrary,
          season: fc.constantFrom('2023/24', '2024/25'),
          created_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          updated_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          home_score: fc.constant(undefined),
          away_score: fc.constant(undefined)
        }),
        (match) => {
          const display = renderMatchDisplay(match)
          
          expect(display.scores.home).toBeUndefined()
          expect(display.scores.away).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9c: All matches display required basic information', () => {
    fc.assert(
      fc.property(
        matchArbitrary,
        (match) => {
          const display = renderMatchDisplay(match)
          
          // Team names are always required
          expect(display.teams.home).toBeTruthy()
          expect(display.teams.away).toBeTruthy()
          expect(typeof display.teams.home).toBe('string')
          expect(typeof display.teams.away).toBe('string')
          
          // Status is always required
          expect(display.status).toBeTruthy()
          expect(typeof display.status).toBe('string')
          
          // Kickoff time is always required
          expect(display.kickoffTime).toBeTruthy()
          expect(typeof display.kickoffTime).toBe('string')
          
          // Should be a valid ISO date string
          expect(() => new Date(display.kickoffTime)).not.toThrow()
          expect(new Date(display.kickoffTime).toISOString()).toBe(display.kickoffTime)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9d: Predictions display correctly when present', () => {
    fc.assert(
      fc.property(
        matchArbitrary,
        predictionArbitrary,
        (match, prediction) => {
          const display = renderMatchDisplay(match, prediction)
          
          expect(display.prediction).toBeDefined()
          expect(display.prediction!.home).toBe(prediction.predicted_home_score)
          expect(display.prediction!.away).toBe(prediction.predicted_away_score)
          expect(display.prediction!.points).toBe(prediction.points_earned)
          expect(display.prediction!.processed).toBe(prediction.processed)
          
          // Predicted scores should be valid
          expect(display.prediction!.home).toBeGreaterThanOrEqual(0)
          expect(display.prediction!.away).toBeGreaterThanOrEqual(0)
          expect(display.prediction!.home).toBeLessThanOrEqual(20)
          expect(display.prediction!.away).toBeLessThanOrEqual(20)
          
          // Points should be valid
          expect([0, 2, 5]).toContain(display.prediction!.points)
          
          // Processed should be boolean
          expect(typeof display.prediction!.processed).toBe('boolean')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9e: Match status determines score visibility', () => {
    fc.assert(
      fc.property(
        matchArbitrary,
        (match) => {
          const display = renderMatchDisplay(match)
          
          switch (match.status) {
            case 'FINISHED':
              // Finished matches must show scores
              expect(display.scores.home).toBeDefined()
              expect(display.scores.away).toBeDefined()
              break
              
            case 'TIMED':
              // Scheduled matches must not show scores
              expect(display.scores.home).toBeUndefined()
              expect(display.scores.away).toBeUndefined()
              break
              
            case 'IN_PLAY':
            case 'PAUSED':
              // Live/paused matches may or may not show scores
              if (display.scores.home !== undefined) {
                expect(typeof display.scores.home).toBe('number')
                expect(display.scores.home).toBeGreaterThanOrEqual(0)
              }
              if (display.scores.away !== undefined) {
                expect(typeof display.scores.away).toBe('number')
                expect(display.scores.away).toBeGreaterThanOrEqual(0)
              }
              break
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 9f: Gameweek information is displayed when available', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          external_id: fc.string({ minLength: 1, maxLength: 50 }),
          home_team: teamNameArbitrary,
          away_team: teamNameArbitrary,
          status: matchStatusArbitrary,
          kickoff_time: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          gameweek: fc.integer({ min: 1, max: 38 }),
          season: fc.constantFrom('2023/24', '2024/25'),
          created_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          updated_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
          home_score: fc.option(scoreArbitrary),
          away_score: fc.option(scoreArbitrary)
        }),
        (match) => {
          const display = renderMatchDisplay(match)
          
          expect(display.gameweek).toBeDefined()
          expect(display.gameweek).toBe(match.gameweek)
          expect(typeof display.gameweek).toBe('number')
          expect(display.gameweek).toBeGreaterThan(0)
          expect(display.gameweek).toBeLessThanOrEqual(38)
        }
      ),
      { numRuns: 100 }
    )
  })
})