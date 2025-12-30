
import { MemoryBlock } from "../types";
import { syncMemoryToSupabase } from "./supabaseService";

/**
 * Strips Markdown formatting to return raw plain text
 */
export const stripMarkdown = (text: string): string => {
  return text
    .replace(/[#*`_~]/g, '') // Remove simple symbols
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Remove links keep text
    .replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '') // Remove images
    .replace(/^>+ /gm, '') // Remove blockquotes
    .replace(/(\r\n|\n|\r)/gm, ' ') // Optional: flatten lines or keep? Keeping for readability
    .trim();
};

/**
 * Syncs a text string to the Sovereign Memory (Notebook)
 */
export const archiveToSovereignMemory = async (title: string, content: string, agentName: string) => {
  const memory: MemoryBlock = {
    id: `archived_${Math.random().toString(36).substring(2, 9)}`,
    title: `SME Insight: ${title}`,
    content,
    category: 'Strategic',
    assignedAgents: [agentName, 'All Agents'],
    timestamp: Date.now(),
    source: 'distilled'
  };

  const existing = JSON.parse(localStorage.getItem('quanta_notebook') || "[]");
  localStorage.setItem('quanta_notebook', JSON.stringify([memory, ...existing]));
  
  try {
    await syncMemoryToSupabase(memory);
  } catch (e) {
    console.error("Supabase sync failed during archival", e);
  }
  
  return memory;
};

/**
 * Exports text as a downloadable file to the browser
 * @param filename The name of the file without extension
 * @param text The content to export
 * @param extension The file extension (e.g., 'txt', 'md')
 */
export const exportToBrowser = (filename: string, text: string, extension: string = 'txt') => {
  const element = document.createElement("a");
  const mimeType = extension === 'md' ? 'text/markdown' : 'text/plain';
  const file = new Blob([text], { type: mimeType });
  element.href = URL.createObjectURL(file);
  element.download = `${filename}.${extension}`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};
