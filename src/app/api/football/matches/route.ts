import { NextResponse } from "next/server";
import { getPremierLeagueMatches } from "@/lib/football-api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    
    const result = await getPremierLeagueMatches(dateFrom, dateTo);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    });
  }
}