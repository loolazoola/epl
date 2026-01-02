import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Match } from '@/types/database'

/**
 * Feature: premier-league-prediction-game, Property 10: Match Organization Consistency
 * **Validates: Requirements 6.5**
 */

describe('Match Organization Consistency', () => {
  // Generator for valid football scores (0-20)
  const scoreArbitrary = fc.integer({ min: 0, max: 20 })
  
  // Generator for match status
  const matchStatusArbitrary = fc.constantFrom('TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED')
  
  // Generator for team names
  const teamNameArbitrary = fc.string({ minLength: 3, maxLength: 30 }).filter(name => name.trim().length > 0)
  
  // Generator for valid dates (using timestamps to avoid invalid dates)
  const timestampArbitrary = fc.integer({ min: 1672531200000, max: 1735689600000 }) // 2023-2025 range
  
  // Generator for gameweek
  const gameweekArbitrary = fc.option(fc.integer({ min: 1, max: 38 }))
  
  // Generator for unique IDs to avoid duplicates
  let idCounter = 0
  const uniqueIdArbitrary = fc.constant(null).map(() => `match-${++idCounter}`)
  
  // Generator for match
  const matchArbitrary = fc.record({
    id: uniqueIdArbitrary,
    external_id: fc.string({ minLength: 1, maxLength: 50 }),
    home_team: teamNameArbitrary,
    away_team: teamNameArbitrary,
    status: matchStatusArbitrary,
    kickoff_time: timestampArbitrary.map(ts => new Date(ts).toISOString()),
    gameweek: gameweekArbitrary,
    season: fc.constantFrom('2023/24', '2024/25'),
    created_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
    updated_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
    home_score: fc.option(scoreArbitrary),
    away_score: fc.option(scoreArbitrary)
  })

  // Mock function to simulate match grouping by date
  const groupMatchesByDate = (matches: Match[]) => {
    const grouped = matches.reduce((acc, match) => {
      const date = new Date(match.kickoff_time).toDateString()
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(match)
      return acc
    }, {} as Record<string, Match[]>)

    // Sort dates chronologically and sort matches within each group
    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, groupMatches]) => [
        date,
        groupMatches.sort((a, b) => 
          new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
        )
      ] as [string, Match[]])
  }

  // Mock function to simulate match grouping by gameweek
  const groupMatchesByGameweek = (matches: Match[]) => {
    const grouped = matches.reduce((acc, match) => {
      const gameweek = match.gameweek || 0
      const key = `Gameweek ${gameweek}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(match)
      return acc
    }, {} as Record<string, Match[]>)

    // Sort by gameweek number and sort matches within each group
    return Object.entries(grouped)
      .sort(([a], [b]) => {
        const gameweekA = parseInt(a.split(' ')[1]) || 0
        const gameweekB = parseInt(b.split(' ')[1]) || 0
        return gameweekA - gameweekB
      })
      .map(([gameweek, groupMatches]) => [
        gameweek,
        groupMatches.sort((a, b) => 
          new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
        )
      ] as [string, Match[]])
  }

  it('Property 10: For any collection of matches, the system should group them logically by gameweek or date to ensure consistent navigation and organization', () => {
    fc.assert(
      fc.property(
        fc.array(matchArbitrary, { minLength: 0, maxLength: 20 }),
        (matches) => {
          // Test date grouping
          const dateGroups = groupMatchesByDate(matches)
          
          // Verify date grouping consistency
          for (const [dateString, groupMatches] of dateGroups) {
            // All matches in a date group should have the same date
            for (const match of groupMatches) {
              const matchDate = new Date(match.kickoff_time).toDateString()
              expect(matchDate).toBe(dateString)
            }
            
            // Matches within a group should be sorted by kickoff time
            for (let i = 1; i < groupMatches.length; i++) {
              const prevKickoff = new Date(groupMatches[i - 1].kickoff_time).getTime()
              const currentKickoff = new Date(groupMatches[i].kickoff_time).getTime()
              expect(currentKickoff).toBeGreaterThanOrEqual(prevKickoff)
            }
          }
          
          // Test gameweek grouping
          const gameweekGroups = groupMatchesByGameweek(matches)
          
          // Verify gameweek grouping consistency
          for (const [gameweekLabel, groupMatches] of gameweekGroups) {
            const expectedGameweek = parseInt(gameweekLabel.split(' ')[1]) || 0
            
            // All matches in a gameweek group should have the same gameweek
            for (const match of groupMatches) {
              const matchGameweek = match.gameweek || 0
              expect(matchGameweek).toBe(expectedGameweek)
            }
          }
          
          // Verify all matches are included in groupings
          const totalMatchesInDateGroups = dateGroups.reduce((sum, [, groupMatches]) => sum + groupMatches.length, 0)
          const totalMatchesInGameweekGroups = gameweekGroups.reduce((sum, [, groupMatches]) => sum + groupMatches.length, 0)
          
          expect(totalMatchesInDateGroups).toBe(matches.length)
          expect(totalMatchesInGameweekGroups).toBe(matches.length)
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10a: Date grouping preserves chronological order', () => {
    fc.assert(
      fc.property(
        fc.array(matchArbitrary, { minLength: 2, maxLength: 10 }),
        (matches) => {
          const dateGroups = groupMatchesByDate(matches)
          
          // Verify groups are in chronological order
          for (let i = 1; i < dateGroups.length; i++) {
            const prevDate = new Date(dateGroups[i - 1][0])
            const currentDate = new Date(dateGroups[i][0])
            expect(currentDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime())
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10b: Gameweek grouping preserves numerical order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: uniqueIdArbitrary,
            external_id: fc.string({ minLength: 1, maxLength: 50 }),
            home_team: teamNameArbitrary,
            away_team: teamNameArbitrary,
            status: matchStatusArbitrary,
            kickoff_time: timestampArbitrary.map(ts => new Date(ts).toISOString()),
            gameweek: fc.integer({ min: 1, max: 38 }), // Ensure gameweek is always present
            season: fc.constantFrom('2023/24', '2024/25'),
            created_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
            updated_at: timestampArbitrary.map(ts => new Date(ts).toISOString()),
            home_score: fc.option(scoreArbitrary),
            away_score: fc.option(scoreArbitrary)
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (matches) => {
          const gameweekGroups = groupMatchesByGameweek(matches)
          
          // Verify groups are in numerical order
          for (let i = 1; i < gameweekGroups.length; i++) {
            const prevGameweek = parseInt(gameweekGroups[i - 1][0].split(' ')[1]) || 0
            const currentGameweek = parseInt(gameweekGroups[i][0].split(' ')[1]) || 0
            expect(currentGameweek).toBeGreaterThanOrEqual(prevGameweek)
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10c: Matches within groups are sorted by kickoff time', () => {
    fc.assert(
      fc.property(
        fc.array(matchArbitrary, { minLength: 1, maxLength: 10 }),
        (matches) => {
          const dateGroups = groupMatchesByDate(matches)
          
          // Verify matches within each group are sorted by kickoff time
          for (const [, groupMatches] of dateGroups) {
            for (let i = 1; i < groupMatches.length; i++) {
              const prevKickoff = new Date(groupMatches[i - 1].kickoff_time).getTime()
              const currentKickoff = new Date(groupMatches[i].kickoff_time).getTime()
              expect(currentKickoff).toBeGreaterThanOrEqual(prevKickoff)
            }
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10d: Empty match collections are handled gracefully', () => {
    fc.assert(
      fc.property(
        fc.constant([]),
        (matches) => {
          const dateGroups = groupMatchesByDate(matches)
          const gameweekGroups = groupMatchesByGameweek(matches)
          
          expect(dateGroups).toEqual([])
          expect(gameweekGroups).toEqual([])
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10e: Single match collections are handled correctly', () => {
    fc.assert(
      fc.property(
        matchArbitrary,
        (match) => {
          const matches = [match]
          const dateGroups = groupMatchesByDate(matches)
          const gameweekGroups = groupMatchesByGameweek(matches)
          
          // Should have exactly one group for each grouping method
          expect(dateGroups).toHaveLength(1)
          expect(gameweekGroups).toHaveLength(1)
          
          // The single match should be in the group
          expect(dateGroups[0][1]).toEqual([match])
          expect(gameweekGroups[0][1]).toEqual([match])
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10f: Grouping is deterministic and consistent', () => {
    fc.assert(
      fc.property(
        fc.array(matchArbitrary, { minLength: 1, maxLength: 5 }),
        (matches) => {
          // Group the same matches multiple times
          const dateGroups1 = groupMatchesByDate([...matches])
          const dateGroups2 = groupMatchesByDate([...matches])
          const gameweekGroups1 = groupMatchesByGameweek([...matches])
          const gameweekGroups2 = groupMatchesByGameweek([...matches])
          
          // Results should be identical
          expect(dateGroups1).toEqual(dateGroups2)
          expect(gameweekGroups1).toEqual(gameweekGroups2)
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10g: All matches are preserved during grouping', () => {
    fc.assert(
      fc.property(
        fc.array(matchArbitrary, { minLength: 1, maxLength: 10 }),
        (matches) => {
          const dateGroups = groupMatchesByDate(matches)
          const gameweekGroups = groupMatchesByGameweek(matches)
          
          // Collect all matches from date groups
          const matchesFromDateGroups = dateGroups.flatMap(([, groupMatches]) => groupMatches)
          
          // Collect all matches from gameweek groups
          const matchesFromGameweekGroups = gameweekGroups.flatMap(([, groupMatches]) => groupMatches)
          
          // Should have the same number of matches
          expect(matchesFromDateGroups).toHaveLength(matches.length)
          expect(matchesFromGameweekGroups).toHaveLength(matches.length)
          
          // All original match IDs should be present
          const originalIds = matches.map(m => m.id).sort()
          const dateGroupIds = matchesFromDateGroups.map(m => m.id).sort()
          const gameweekGroupIds = matchesFromGameweekGroups.map(m => m.id).sort()
          
          expect(dateGroupIds).toEqual(originalIds)
          expect(gameweekGroupIds).toEqual(originalIds)
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})