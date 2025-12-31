import { NextResponse } from "next/server";
import { testApiConnection } from "@/lib/football-api";

export async function GET() {
  try {
    const result = await testApiConnection();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    });
  }
}