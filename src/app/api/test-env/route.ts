import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const baseUrl = process.env.FOOTBALL_DATA_BASE_URL;
  
  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyFirst4: apiKey?.substring(0, 4) || 'none',
    baseUrl: baseUrl || 'not set',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('FOOTBALL')),
  });
}