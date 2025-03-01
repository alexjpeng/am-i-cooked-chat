import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }
  
  try {
    // Validate that the URL is from Wikipedia
    if (!url.startsWith('https://en.wikipedia.org/')) {
      return NextResponse.json({ error: 'Only Wikipedia URLs are allowed' }, { status: 400 });
    }
    
    // Fetch the content from Wikipedia
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch from Wikipedia: ${response.status} ${response.statusText}` 
      }, { status: response.status });
    }
    
    // Get the HTML content
    const html = await response.text();
    
    // Extract the page title
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - Wikipedia', '') : '';
    
    // Return the content and metadata
    return NextResponse.json({
      url,
      title,
      html
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch content' 
    }, { status: 500 });
  }
} 