export type CrawlSourceType =
  | "Homepage"
  | "Help Center"
  | "Documentation"
  | "FAQ"
  | "Pricing"
  | "API Docs"
  | "Blog"
  | "Release Notes"
  | "Changelog"
  | "Terms of Service"
  | "Privacy Policy"
  | "Contact Page"
  | "Status Page"
  | "Community Page";

export type CrawlSource = {
  id: string;
  type: CrawlSourceType;
  title: string;
  url: string;
  status: "Indexed" | "Queued" | "Skipped";
  discoveredBy: "homepage" | "sitemap" | "common-path" | "fallback";
  articleEstimate: number;
  chunkEstimate: number;
};

export type CompanyProfile = {
  company: string;
  industry: string;
  products: string[];
  audience: string[];
  tone: string[];
  brandVocabulary: string[];
  supportChannels: string[];
  knowledgeBase: string[];
  lastSynced: string;
};

export type CompanyBrainMetrics = {
  status: "Ready" | "Building" | "Needs review";
  pagesIndexed: number;
  knowledgeArticles: number;
  chunks: number;
  embeddings: number;
  languages: string[];
  lastCrawl: string;
  syncHealth: "Healthy" | "Partial" | "Needs review";
};

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  group: "Company" | "Product" | "Audience" | "Policy" | "Support";
};

export type CompanyBrain = {
  id: string;
  organizationId: string;
  website: string;
  profile: CompanyProfile;
  metrics: CompanyBrainMetrics;
  crawledSources: CrawlSource[];
  graph: KnowledgeGraphNode[];
  createdAt: string;
};

export type PipelineStepId =
  | "website"
  | "crawler"
  | "discovery"
  | "extraction"
  | "cleaning"
  | "classification"
  | "chunking"
  | "embedding"
  | "vector"
  | "graph"
  | "ready";

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
};

export const companyBrainPipeline: PipelineStep[] = [
  { id: "website", label: "Website URL" },
  { id: "crawler", label: "Website Crawler" },
  { id: "discovery", label: "Page Discovery" },
  { id: "extraction", label: "Document Extraction" },
  { id: "cleaning", label: "HTML Cleaning" },
  { id: "classification", label: "Document Classification" },
  { id: "chunking", label: "Chunking" },
  { id: "embedding", label: "Embedding Generation" },
  { id: "vector", label: "Vector Database" },
  { id: "graph", label: "Knowledge Graph" },
  { id: "ready", label: "Workspace Ready" }
];

export const crawlSourceCatalog: Array<{ type: CrawlSourceType; paths: string[] }> = [
  { type: "Homepage", paths: ["/"] },
  { type: "Help Center", paths: ["/help", "/support", "/help-center"] },
  { type: "Documentation", paths: ["/docs", "/documentation"] },
  { type: "FAQ", paths: ["/faq", "/faqs"] },
  { type: "Pricing", paths: ["/pricing"] },
  { type: "API Docs", paths: ["/api", "/developers", "/docs/api"] },
  { type: "Blog", paths: ["/blog"] },
  { type: "Release Notes", paths: ["/release-notes", "/releases"] },
  { type: "Changelog", paths: ["/changelog"] },
  { type: "Terms of Service", paths: ["/terms", "/terms-of-service"] },
  { type: "Privacy Policy", paths: ["/privacy", "/privacy-policy"] },
  { type: "Contact Page", paths: ["/contact", "/contact-us"] },
  { type: "Status Page", paths: ["/status"] },
  { type: "Community Page", paths: ["/community"] }
];

export function normalizeWebsiteInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter a company website.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.origin;
}

export function getCompanyNameFromWebsite(website: string) {
  const hostname = new URL(website).hostname.replace(/^www\./, "");
  const base = hostname.split(".")[0] || "Company";
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function createCompanyBrain({
  organizationId,
  website,
  discoveredSources
}: {
  organizationId: string;
  website: string;
  discoveredSources?: CrawlSource[];
}): CompanyBrain {
  const hostname = new URL(website).hostname.toLowerCase();
  const isPicX = hostname.includes("picx");
  const company = isPicX ? "PicX Studio" : getCompanyNameFromWebsite(website);
  const now = new Date().toISOString();
  const sources = discoveredSources?.length
    ? discoveredSources
    : createFallbackSources(website, isPicX);
  const pagesIndexed = isPicX ? 128 : Math.max(18, sources.length * 7);
  const knowledgeArticles = isPicX ? 312 : Math.max(36, sources.length * 12);
  const chunks = isPicX ? 6142 : knowledgeArticles * 18;

  const profile: CompanyProfile = isPicX
    ? {
        company,
        industry: "AI Creative Platform",
        products: ["AI Image Generation", "AI Video", "Upscaling", "Headshots"],
        audience: ["Creators", "Designers", "Developers"],
        tone: ["Friendly", "Professional", "Helpful"],
        brandVocabulary: ["Credits", "Render", "Workspace", "Generation", "License"],
        supportChannels: ["Email", "Knowledge Base", "Documentation", "API"],
        knowledgeBase: ["Help Center", "Documentation", "API Docs", "Policies"],
        lastSynced: "Today"
      }
    : {
        company,
        industry: inferIndustry(sources),
        products: inferProducts(sources),
        audience: ["Customers", "Admins", "Developers"],
        tone: ["Clear", "Professional", "Helpful"],
        brandVocabulary: inferVocabulary(company, sources),
        supportChannels: inferSupportChannels(sources),
        knowledgeBase: sources.map((source) => source.type).slice(0, 5),
        lastSynced: "Today"
      };

  return {
    id: `brain_${organizationId}_${Date.now()}`,
    organizationId,
    website,
    profile,
    metrics: {
      status: "Ready",
      pagesIndexed,
      knowledgeArticles,
      chunks,
      embeddings: chunks,
      languages: ["English"],
      lastCrawl: "Today",
      syncHealth: sources.length >= 5 ? "Healthy" : "Partial"
    },
    crawledSources: sources,
    graph: createGraph(profile),
    createdAt: now
  };
}

function createFallbackSources(website: string, isPicX: boolean): CrawlSource[] {
  const preferredTypes: CrawlSourceType[] = isPicX
    ? [
        "Homepage",
        "Help Center",
        "Documentation",
        "FAQ",
        "Pricing",
        "API Docs",
        "Blog",
        "Release Notes",
        "Terms of Service",
        "Privacy Policy",
        "Contact Page",
        "Status Page"
      ]
    : ["Homepage", "Documentation", "FAQ", "Pricing", "Blog", "Terms of Service", "Privacy Policy"];

  return preferredTypes.map((type, index) => {
    const catalog = crawlSourceCatalog.find((item) => item.type === type);
    const path = catalog?.paths[0] || "/";
    return createSource({
      website,
      type,
      path,
      title: type,
      discoveredBy: "fallback",
      index
    });
  });
}

export function createSource({
  website,
  type,
  path,
  title,
  discoveredBy,
  index
}: {
  website: string;
  type: CrawlSourceType;
  path: string;
  title?: string;
  discoveredBy: CrawlSource["discoveredBy"];
  index: number;
}): CrawlSource {
  const url = new URL(path, website);
  const articleEstimate = type === "Homepage" ? 1 : 12 + index * 3;
  return {
    id: `${type.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${index}`,
    type,
    title: title || type,
    url: url.toString(),
    status: "Indexed",
    discoveredBy,
    articleEstimate,
    chunkEstimate: articleEstimate * 18
  };
}

function inferIndustry(sources: CrawlSource[]) {
  const text = sources.map((source) => `${source.title} ${source.url}`).join(" ").toLowerCase();
  if (text.includes("api") || text.includes("developer")) return "Developer Platform";
  if (text.includes("pricing") || text.includes("docs")) return "SaaS Platform";
  return "Software Company";
}

function inferProducts(sources: CrawlSource[]) {
  const productSet = new Set<string>();
  if (sources.some((source) => source.type === "API Docs")) productSet.add("API");
  if (sources.some((source) => source.type === "Documentation")) productSet.add("Documentation");
  if (sources.some((source) => source.type === "Help Center")) productSet.add("Support Center");
  if (sources.some((source) => source.type === "Pricing")) productSet.add("Subscriptions");
  return Array.from(productSet).length ? Array.from(productSet) : ["Core Product", "Support Portal"];
}

function inferVocabulary(company: string, sources: CrawlSource[]) {
  const words = new Set<string>([company, "Account", "Plan", "Workspace", "Support"]);
  sources.forEach((source) => words.add(source.type.replace(" Page", "")));
  return Array.from(words).slice(0, 8);
}

function inferSupportChannels(sources: CrawlSource[]) {
  const channels = new Set<string>(["Email"]);
  if (sources.some((source) => source.type === "Help Center")) channels.add("Knowledge Base");
  if (sources.some((source) => source.type === "Documentation")) channels.add("Documentation");
  if (sources.some((source) => source.type === "API Docs")) channels.add("API");
  if (sources.some((source) => source.type === "Community Page")) channels.add("Community");
  return Array.from(channels);
}

function createGraph(profile: CompanyProfile): KnowledgeGraphNode[] {
  return [
    { id: "company", label: profile.company, group: "Company" },
    ...profile.products.map((label, index) => ({
      id: `product_${index}`,
      label,
      group: "Product" as const
    })),
    ...profile.audience.map((label, index) => ({
      id: `audience_${index}`,
      label,
      group: "Audience" as const
    })),
    ...profile.knowledgeBase.slice(0, 4).map((label, index) => ({
      id: `knowledge_${index}`,
      label,
      group: "Support" as const
    }))
  ];
}

