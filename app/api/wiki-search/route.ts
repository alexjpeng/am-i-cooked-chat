import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }
  
  try {
    // Use Wikipedia's API to search for pages
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`;
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`Wikipedia API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // The API returns an array with 4 elements:
    // [0] => search term
    // [1] => array of titles
    // [2] => array of descriptions
    // [3] => array of URLs
    
    // We'll convert this to a more usable format
    const titles = data[1] || [];
    const descriptions = data[2] || [];
    const urls = data[3] || [];
    
    const results = titles.map((title: string, index: number) => {
      // Extract the page name from the URL
      const url = urls[index];
      const pageName = url.split('/wiki/')[1];
      
      return {
        title,
        description: descriptions[index],
        pageName
      };
    });
    
    return NextResponse.json({ results });
    
  } catch (error) {
    console.error('Error fetching Wikipedia search results:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch search results',
      results: [] 
    }, { status: 500 });
  }
} 