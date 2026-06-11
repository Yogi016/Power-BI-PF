export type ChatbotSourceType = 'evidence' | 'document' | 'asset';

export interface ChatbotSource {
  id: string;
  type: ChatbotSourceType;
  title: string;
  subtitle: string;
  url: string;
  projectName?: string;
  meta?: string;
}
