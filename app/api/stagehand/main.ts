/**
 * 🤘 WikiRace AI with Stagehand!
 *
 * This script implements an AI opponent for a Wikipedia race game.
 * The AI will navigate from a start Wikipedia page to a target page
 * using only hyperlinks, competing against the human player.
 */

import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

// Define interface for WikiRace game parameters
interface WikiRaceParams {
  startPage: string;
  targetPage: string;
}

const chalkYellow = (msg: string) => chalk.hex('#FEC83C')(msg);
const chalkPink = (msg: string) => chalk.hex('#FF69B4')(msg);

export async function main({
  page,
  context,
  stagehand,
  gameParams,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
  gameParams?: WikiRaceParams; // Game parameters
}) {
  // Default game parameters if none provided
  const startPage = gameParams?.startPage || "Pizza";
  const targetPage = gameParams?.targetPage || "Albert_Einstein";

  console.log(
    [
      `🔥 ${chalkYellow("WikiRace AI Starting!")}`,
      "",
      `Starting page: ${chalkPink(startPage)}`,
      `Target page: ${chalkPink(targetPage)}`,
      "",
      "The AI will now attempt to navigate from the start page to the target page",
      "using only Wikipedia hyperlinks. Let the race begin!"
    ].join("\n")
  );

  // Navigate to the start page
  await page.goto(`https://en.wikipedia.org/wiki/${startPage}`);
  console.log(`Navigated to start page: ${startPage}`);

  // Track the path taken
  const path = [startPage];
  let currentPage = startPage;
  let targetReached = false;
  let maxAttempts = 15; // Limit the number of attempts to prevent infinite loops
  
  // Main navigation loop
  while (!targetReached && maxAttempts > 0) {
    try {
      // Extract all links from the current page
      const extractResult = await page.extract({
        instruction: "extract all links on this Wikipedia page, including their text and href attributes",
        schema: z.object({
          links: z.array(z.object({
            text: z.string(),
            href: z.string(),
          })),
        }),
        useTextExtract: true,
      });
      
      console.log(`Found ${extractResult.links.length} links on the current page`);
      
      // Filter links to only include Wikipedia article links
      const wikiLinks = extractResult.links.filter(link => {
        return link.href.includes('/wiki/') && 
               !link.href.includes(':') && 
               !link.href.includes('File:') &&
               !link.href.includes('Special:') &&
               !link.href.includes('Wikipedia:') &&
               !link.href.includes('Help:') &&
               !link.href.includes('Template:') &&
               !link.href.includes('Category:') &&
               !link.href.includes('Portal:') &&
               !link.href.includes('Talk:');
      });
      
      // Check if the target page is directly linked
      const targetLink = wikiLinks.find(link => 
        link.href.toLowerCase().includes(targetPage.toLowerCase()) || 
        link.text.toLowerCase().includes(targetPage.replace(/_/g, ' ').toLowerCase())
      );
      
      if (targetLink) {
        // Target found! Click it
        console.log(`🎯 Found direct link to target: ${targetLink.text}`);
        
        await page.act({
          action: `click the link to ${targetLink.text}`,
        });
        
        path.push(targetPage);
        targetReached = true;
        break;
      }
      
      // Strategic link selection - try to find a link that might lead to the target
      // This is where the AI "intelligence" comes in
      const nextLink = await findBestLink(page, wikiLinks, targetPage);
      
      if (nextLink) {
        console.log(`Choosing link: ${nextLink.text}`);
        
        // Click the chosen link using act
        await page.act({
          action: `click the link to ${nextLink.text}`,
        });
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Get the new page title
        const newPageTitle = await page.title();
        const simplifiedTitle = newPageTitle.replace(' - Wikipedia', '');
        
        path.push(simplifiedTitle);
        currentPage = simplifiedTitle;
        
        // Check if we've reached the target
        if (
          newPageTitle.toLowerCase().includes(targetPage.toLowerCase().replace(/_/g, ' ')) || 
          page.url().toLowerCase().includes(targetPage.toLowerCase())
        ) {
          console.log(`🏆 Target reached: ${newPageTitle}`);
          targetReached = true;
          break;
        }
      } else {
        // No good link found, go back and try a different path
        console.log('No promising links found, going back...');
        await page.goBack();
        path.pop(); // Remove the current page from path
      }
      
    } catch (error) {
      console.error('Error during navigation:', error);
      // Try to recover by using a more general act command
      try {
        await page.act({
          action: `find and click a link that might lead to ${targetPage.replace(/_/g, ' ')}`,
        });
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Get the new page title
        const newPageTitle = await page.title();
        const simplifiedTitle = newPageTitle.replace(' - Wikipedia', '');
        
        path.push(simplifiedTitle);
        currentPage = simplifiedTitle;
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
      }
    }
    
    maxAttempts--;
  }
  
  // Report results
  if (targetReached) {
    console.log(`
      🎉 AI successfully navigated from ${startPage} to ${targetPage}!
      Path taken: ${path.join(' → ')}
      Number of clicks: ${path.length - 1}
    `);
  } else {
    console.log(`
      😢 AI failed to reach ${targetPage} within the attempt limit.
      Path so far: ${path.join(' → ')}
      Number of clicks: ${path.length - 1}
    `);
  }
}

/**
 * Find the best link to follow based on relevance to the target
 */
async function findBestLink(page: Page, links: any[], targetPage: string) {
  // Use Stagehand's observe to get AI assistance in choosing the best link
  const targetTopic = targetPage.replace(/_/g, ' ');
  
  try {
    // First, try to use AI to evaluate which link is most promising
    const observation = await page.observe({
      instruction: `Find the link that is most likely to lead to the topic "${targetTopic}"`,
    });
    
    if (observation.length > 0) {
      // Find the link that matches the observation
      const recommendedLink = links.find(link => 
        observation.some(obs => 
          link.text.includes(obs.description) || 
          (obs.selector && obs.selector.includes(link.text))
        )
      );
      
      if (recommendedLink) {
        return recommendedLink;
      }
    }
  } catch (error) {
    console.error('Error using observe for link selection:', error);
  }
  
  // Fallback: simple heuristic approach
  // Look for links that might be related to the target topic
  const targetWords = targetTopic.toLowerCase().split(' ');
  
  // Score each link based on word overlap with target
  const scoredLinks = links.map(link => {
    const linkText = link.text.toLowerCase();
    let score = 0;
    
    // Check for direct word matches
    for (const word of targetWords) {
      if (linkText.includes(word)) {
        score += 3;
      }
    }
    
    // Bonus for links to broader categories that might contain the target
    const broaderCategories = [
      'science', 'history', 'geography', 'physics', 'mathematics',
      'biography', 'people', 'person', 'country', 'nation', 'politics',
      'art', 'music', 'literature', 'philosophy', 'religion'
    ];
    
    for (const category of broaderCategories) {
      if (linkText.includes(category)) {
        score += 1;
      }
    }
    
    return { ...link, score };
  });
  
  // Sort by score and return the highest scoring link
  scoredLinks.sort((a, b) => b.score - a.score);
  
  // Return the highest scoring link, or a random link if no good matches
  if (scoredLinks.length > 0) {
    if (scoredLinks[0].score > 0) {
      return scoredLinks[0];
    } else {
      // If no good matches, pick a random link to explore
      return links[Math.floor(Math.random() * links.length)];
    }
  }
  
  return null;
}
