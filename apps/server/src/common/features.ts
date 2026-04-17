export const Feature = {
  SSO_CUSTOM: 'sso:custom',
  SSO_GOOGLE: 'sso:google',
  AI: 'ai',
  CONFLUENCE_IMPORT: 'import:confluence',
  ATTACHMENT_INDEXING: 'attachment:indexing',
  MCP: 'mcp',
  SCIM: 'scim',
  TEMPLATES: 'templates',
  PDF_EXPORT: 'export:pdf',
} as const;

export type FeatureKey = (typeof Feature)[keyof typeof Feature];
