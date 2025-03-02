'use client';

import { useState, useRef, useEffect } from 'react';
import './WikiFrame.css';

interface WikiFrameProps {
  startPage: string;
  targetPage: string;
  onNavigation: (url: string, title: string) => void;
  onTargetReached: () => void;
}

export default function WikiFrame({ startPage, targetPage, onNavigation, onTargetReached }: WikiFrameProps) {
  const [currentUrl, setCurrentUrl] = useState(`https://en.wikipedia.org/wiki/${startPage}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  
  // Load Wikipedia content through our proxy
  const loadWikipediaContent = async (url: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load Wikipedia content');
      }
      
      const data = await response.json();
      
      // Update the content
      if (contentRef.current) {
        // Create a temporary div to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.html;
        
        // Extract the main content
        const content = tempDiv.querySelector('#content');
        if (content) {
          // Clear existing content
          contentRef.current.innerHTML = '';
          
          // Add only the main content
          contentRef.current.appendChild(content);
          
          // Modify links to intercept navigation
          modifyLinks(contentRef.current);
          
          // Notify parent component about navigation
          if (!isInitialLoad.current || !url.includes(`/wiki/${startPage}`)) {
            onNavigation(url, data.title);
          }
          
          // Reset the initial load flag
          isInitialLoad.current = false;
          
          // Check if we've reached the target
          if (
            url.toLowerCase().includes(targetPage.toLowerCase()) ||
            data.title.toLowerCase().includes(targetPage.toLowerCase().replace(/_/g, ' '))
          ) {
            onTargetReached();
          }
        } else {
          setError('Could not extract Wikipedia content');
        }
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Modify all links to intercept navigation
  const modifyLinks = (element: HTMLElement) => {
    const links = element.querySelectorAll('a');
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      
      // Only modify Wikipedia article links
      if (href && href.startsWith('/wiki/') && 
          !href.includes(':') && 
          !href.includes('File:') &&
          !href.includes('Special:') &&
          !href.includes('Wikipedia:') &&
          !href.includes('Help:') &&
          !href.includes('Template:') &&
          !href.includes('Category:') &&
          !href.includes('Portal:') &&
          !href.includes('Talk:')) {
        
        // Replace the original click behavior
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const newUrl = `https://en.wikipedia.org${href}`;
          setCurrentUrl(newUrl);
        });
      }
    });
  };
  
  // Load content when URL changes
  useEffect(() => {
    loadWikipediaContent(currentUrl);
  }, [currentUrl]);
  
  // Initialize with the start page
  useEffect(() => {
    // Reset the URL and the initial load flag when the start page changes
    isInitialLoad.current = true;
    setCurrentUrl(`https://en.wikipedia.org/wiki/${startPage}`);
  }, [startPage]);
  
  return (
    <div className="flex flex-col h-full">
      {/* Content area */}
      <div className="flex-1 overflow-auto bg-white">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="spinner"></div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
        
        <div ref={contentRef} className="wikipedia-content"></div>
      </div>
      
    </div>
  );
} 