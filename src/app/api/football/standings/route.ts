import { NextResponse } from "next/server";
import { getPremierLeagueStandings } from "@/lib/football-api";

export async function GET() {
  try {
    const result = await getPremierLeagueStandings();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    });
  }
}