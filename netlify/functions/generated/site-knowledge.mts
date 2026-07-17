// This placeholder is replaced by scripts/build-chat-knowledge.mjs during deploys.
export const siteKnowledge: readonly SiteKnowledgeChunk[] = [];

type SiteKnowledgeChunk = {
  path: string;
  title: string;
  chunk: number;
  text: string;
};
