/**
 * 🤘 WikiRace AI with Stagehand!
 *
 * This script implements an AI opponent for a Wikipedia race game.
 * The AI will navigate from a start Wikipedia page to a target page
 * using only hyperlinks, competing against the human player.
 */

import { Page, Stagehand } from "@browserbasehq/stagehand";
// import { z } from "zod";
import chalk from "chalk";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// Define interface for WikiRace game parameters
interface WikiRaceParams {
  startPage: string;
  targetPage: string;
}

const chalkYellow = (msg: string) => chalk.hex('#FEC83C')(msg);
const chalkPink = (msg: string) => chalk.hex('#FF69B4')(msg);
const chalkGreen = (msg: string) => chalk.hex('#4CAF50')(msg);
const chalkRed = (msg: string) => chalk.hex('#F44336')(msg);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function main({
  page,
  gameParams,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  stagehand?: Stagehand; // Optional Stagehand instance
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
  let targetReached = false;
  let maxAttempts = 15; // Limit the number of attempts to prevent infinite loops
  
  // Main navigation loop
  while (!targetReached && maxAttempts > 0) {
    try {
      // Get the current page title for logging and decision making
      const currentPageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`\n${chalkYellow('Currently on:')} ${currentPageTitle}`);
      
      // Check if we've reached the target
      if (
        currentPageTitle.toLowerCase().includes(targetPage.toLowerCase().replace(/_/g, ' ')) || 
        currentUrl.toLowerCase().includes(targetPage.toLowerCase())
      ) {
        console.log(`${chalkGreen('🏆 Target reached:')} ${currentPageTitle}`);
        targetReached = true;
        break;
      }
      
      // 1. Use plain Playwright to get all links on the page
      console.log('Finding all valid Wikipedia links on this page...');
      const links = await getWikipediaLinks(page);
      console.log(`Found ${links.length} valid Wikipedia links on the current page`);
      
      if (links.length === 0) {
        console.log(chalkRed('No valid links found on this page, going back...'));
        await page.goBack();
        path.pop();
        maxAttempts--;
        continue;
      }
      
      // 2. Use OpenAI to decide which link to click
      console.log(`Asking OpenAI to decide which link best leads to "${targetPage.replace(/_/g, ' ')}"...`);
      const bestLink = await decideBestLink(links, targetPage, currentPageTitle);
      
      if (bestLink) {
        console.log(`${chalkGreen('AI decided to click:')} ${bestLink.text}`);
        
        await page.act({
          action: `click the link to "${bestLink.text}."`,
        });
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Get the new page title and update path
        const newPageTitle = await page.title();
        const simplifiedTitle = newPageTitle.replace(' - Wikipedia', '');
        path.push(simplifiedTitle);
        
        console.log(`${chalkYellow('Path so far:')} ${path.join(' → ')}`);
      } else {
        console.log(chalkRed('No suitable link found, going back...'));
        await page.goBack();
        path.pop(); // Remove the current page from path
      }
      
    } catch (error) {
      console.error(chalkRed('Error during navigation:'), error);
      
      // Try to recover by using a general act command
      try {
        console.log('Attempting recovery with general Stagehand act...');
        await page.act({
          action: `find and click a link that might lead to ${targetPage.replace(/_/g, ' ')}`,
        });
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Get the new page title
        const newPageTitle = await page.title();
        const simplifiedTitle = newPageTitle.replace(' - Wikipedia', '');
        path.push(simplifiedTitle);
      } catch (recoveryError) {
        console.error(chalkRed('Recovery failed:'), recoveryError);
        // Go back as a last resort
        try {
          await page.goBack();
          path.pop();
        } catch {
          // If even going back fails, just continue to the next iteration
          console.error('Unable to go back, continuing...');
        }
      }
    }
    
    maxAttempts--;
  }
  
  // Report results
  if (targetReached) {
    console.log(`
      ${chalkGreen('🎉 SUCCESS!')} AI successfully navigated from ${startPage} to ${targetPage}!
      ${chalkYellow('Path taken:')} ${path.join(' → ')}
      ${chalkYellow('Number of clicks:')} ${path.length - 1}
    `);
  } else {
    console.log(`
      ${chalkRed('😢 FAILED!')} AI couldn't reach ${targetPage} within the attempt limit.
      ${chalkYellow('Path so far:')} ${path.join(' → ')}
      ${chalkYellow('Number of clicks:')} ${path.length - 1}
    `);
  }
}

/**
 * Get all valid Wikipedia article links from the current page
 */
async function getWikipediaLinks(page: Page): Promise<Array<{ text: string; href: string }>> {
  return await page.evaluate(() => {
    const linkElements = Array.from(document.querySelectorAll('a[href^="/wiki/"]'));
    return linkElements
      .map(el => ({
        text: el.textContent?.trim() || "",
        href: el.getAttribute('href') || "",
      }))
      // Filter out non-article links and links with very short text
      .filter(link => 
        link.href.includes('/wiki/') && 
        !link.href.includes(':') && 
        !link.href.includes('File:') &&
        !link.href.includes('Special:') &&
        !link.href.includes('Wikipedia:') &&
        !link.href.includes('Help:') &&
        !link.href.includes('Template:') &&
        !link.href.includes('Category:') &&
        !link.href.includes('Portal:') &&
        !link.href.includes('Talk:') &&
        !link.href.includes('Main Page') &&
        link.text.length > 1 && // Skip very short link text
        !link.text.match(/^\[\d+\]$/) // Skip citation links like [1], [2], etc.
      );
  });
}

/**
 * Use OpenAI to decide which link is most likely to lead closer to the target page
 */
async function decideBestLink(
  links: { text: string; href: string }[], 
  targetPage: string,
  currentPageTitle: string
): Promise<{ text: string; href: string } | null> {
  if (links.length === 0) return null;
  
  // Prepare a sample of links for the AI to consider (to avoid token limits)
  const linkSample = links.length > 75 ? links.slice(0, 75) : links;
  const formattedLinks = linkSample.map(link => `- ${link.text} (${link.href})`).join('\n');
  
  const targetTopic = targetPage.replace(/_/g, ' ');
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant helping navigate a Wikipedia race. Your task is to analyze links on the current page and determine which one is most likely to lead closer to the target page "${targetTopic}".

You must return ONLY the exact text of the link you recommend clicking, with no additional content, explanation, or formatting.

Make strategic choices based on:
1. Direct relevance to the target topic
2. Broader categories that might contain the target
3. Related fields or concepts that could lead to the target
4. Historical, geographical, or thematic connections`
        },
        {
          role: "user",
          content: `
I'm currently on the Wikipedia page "${currentPageTitle}".
My target is to reach the page about "${targetTopic}".

Here are available links on the current page:

${formattedLinks}

Which ONE link should I click that would most likely lead me closer to "${targetTopic}"? Return ONLY the exact text of the best link to click, nothing else.`
        }
      ],
      temperature: 0.2,
      max_tokens: 50
    });

    const bestLinkText = response.choices[0].message.content?.trim();
    if (!bestLinkText) {
      console.log('OpenAI returned empty response, using fallback');
      return links[0];
    }
    
    // Try to find the exact link first
    let bestLink = links.find(link => link.text === bestLinkText);
    
    // If no exact match, try fuzzy matching
    if (!bestLink) {
      bestLink = links.find(link => 
        link.text.includes(bestLinkText) || 
        bestLinkText.includes(link.text) ||
        link.text.toLowerCase() === bestLinkText.toLowerCase()
      );
    }
    
    // If still no match, try more aggressive fuzzy matching by tokenizing
    if (!bestLink) {
      const bestLinkWords = bestLinkText.toLowerCase().split(/\s+/);
      const linkScores = links.map(link => {
        const linkText = link.text.toLowerCase();
        const score = bestLinkWords.filter(word => linkText.includes(word)).length / bestLinkWords.length;
        return { link, score };
      });
      
      // Sort by score descending
      linkScores.sort((a, b) => b.score - a.score);
      
      // If best match has reasonable score, use it
      if (linkScores[0].score > 0.5) {
        bestLink = linkScores[0].link;
        console.log(`Fuzzy matched "${bestLinkText}" to "${bestLink.text}" with score ${linkScores[0].score}`);
      }
    }
    
    if (bestLink) {
      return bestLink;
    } else {
      // If no match found, use a fallback
      console.log(`OpenAI suggestion "${bestLinkText}" couldn't be matched to a link, using fallback`);
      return links[0];
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    
    // Fallback - return a random link with preference to important-looking ones
    const potentialGoodLinks = links.filter(link => 
      link.text.length > 10 || // Longer links might be more substantial
      link.text.charAt(0).toUpperCase() === link.text.charAt(0) // Capitalized links might be important topics
    );
    
    const fallbackLinks = potentialGoodLinks.length > 0 ? potentialGoodLinks : links;
    return fallbackLinks[Math.floor(Math.random() * fallbackLinks.length)];
  }
}
