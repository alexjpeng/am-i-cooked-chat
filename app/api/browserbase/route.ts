import { NextRequest, NextResponse } from 'next/server';

// Define the response type for the Browserbase API
interface BrowserbaseSessionResponse {
  debuggerFullscreenUrl: string;
  debuggerUrl: string;
  pages: {
    id: string;
    url: string;
    faviconUrl: string;
    title: string;
    debuggerUrl: string;
    debuggerFullscreenUrl: string;
  }[];
  wsUrl: string;
}

export async function GET(request: NextRequest) {
  // Get the session ID from the query parameters
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }
  
  const apiKey = process.env.BROWSERBASE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'Browserbase API key not configured' }, { status: 500 });
  }
  
  try {
    // Fetch the session data from Browserbase
    const options = {
      method: 'GET',
      headers: { 'X-BB-API-Key': apiKey }
    };
    
    const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, options);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch session data: ${response.statusText}` }, 
        { status: response.status }
      );
    }
    
    const data: BrowserbaseSessionResponse = await response.json();
    
    // Return the session data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Browserbase session data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session data' }, 
      { status: 500 }
    );
  }
} 