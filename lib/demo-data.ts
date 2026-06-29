import {
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  Clapperboard,
  CircleDollarSign,
  FlaskConical,
  FileText,
  Inbox,
  LayoutDashboard,
  Microscope,
  Settings,
  Sparkles,
  Workflow
} from "lucide-react";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: "Demo" | "Pro" | "Enterprise";
  website: string;
  supportEmail: string;
  timezone: string;
  brandColor: string;
  logoUrl?: string;
  aiTone: string;
  escalationThreshold: number;
};

export type DemoConversation = {
  id: string;
  organizationId: string;
  customer: string;
  subject: string;
  status: "Open" | "Waiting" | "Escalated" | "Resolved";
  intent: string;
  sentiment: string;
  priority: "Low" | "Medium" | "High";
};

export type KnowledgeSource = {
  id: string;
  organizationId: string;
  title: string;
  category: string;
  status: "Ready" | "Syncing" | "Needs review";
  chunks: number;
};

export type WorkflowItem = {
  id: string;
  organizationId: string;
  name: string;
  trigger: string;
  destination: string;
  enabled: boolean;
};

export const demoOrganizations: Organization[] = [
  {
    id: "org_picx",
    name: "PicX Studio",
    slug: "picx-studio",
    plan: "Demo",
    website: "https://picxstudio.com",
    supportEmail: "support@picx.example",
    timezone: "America/Los_Angeles",
    brandColor: "#1f8a5b",
    aiTone: "Calm, clear, premium",
    escalationThreshold: 0.72
  },
  {
    id: "org_northstar",
    name: "Northstar Labs",
    slug: "northstar-labs",
    plan: "Pro",
    website: "https://northstar.example",
    supportEmail: "help@northstar.example",
    timezone: "America/New_York",
    brandColor: "#2563eb",
    aiTone: "Technical, direct, helpful",
    escalationThreshold: 0.68
  }
];

export const demoConversations: DemoConversation[] = [
  {
    id: "conv_1001",
    organizationId: "org_picx",
    customer: "Maya Chen",
    subject: "Credits missing after plan upgrade",
    status: "Open",
    intent: "Credits",
    sentiment: "Confused",
    priority: "High"
  },
  {
    id: "conv_1002",
    organizationId: "org_picx",
    customer: "Jordan Ellis",
    subject: "Render failed and used credits",
    status: "Escalated",
    intent: "Generation Failure",
    sentiment: "Frustrated",
    priority: "High"
  },
  {
    id: "conv_1003",
    organizationId: "org_picx",
    customer: "Ari Morgan",
    subject: "Commercial license question",
    status: "Waiting",
    intent: "License",
    sentiment: "Neutral",
    priority: "Medium"
  },
  {
    id: "conv_2001",
    organizationId: "org_northstar",
    customer: "Sam Patel",
    subject: "API request returns 429",
    status: "Open",
    intent: "API",
    sentiment: "Urgent",
    priority: "High"
  }
];

export const demoKnowledgeSources: KnowledgeSource[] = [
  {
    id: "doc_credits",
    organizationId: "org_picx",
    title: "Credits FAQ",
    category: "Billing",
    status: "Ready",
    chunks: 18
  },
  {
    id: "doc_rendering",
    organizationId: "org_picx",
    title: "Rendering Troubleshooting",
    category: "Troubleshooting",
    status: "Ready",
    chunks: 24
  },
  {
    id: "doc_license",
    organizationId: "org_picx",
    title: "Commercial License Policy",
    category: "Policies",
    status: "Needs review",
    chunks: 9
  },
  {
    id: "doc_api",
    organizationId: "org_northstar",
    title: "API Rate Limits",
    category: "API",
    status: "Ready",
    chunks: 14
  }
];

export const demoWorkflows: WorkflowItem[] = [
  {
    id: "wf_credits",
    organizationId: "org_picx",
    name: "Credits Missing",
    trigger: "Billing + Credits intent",
    destination: "Billing queue",
    enabled: true
  },
  {
    id: "wf_render",
    organizationId: "org_picx",
    name: "Image Generation Failed",
    trigger: "Render failed or generation error",
    destination: "Support engineering",
    enabled: true
  },
  {
    id: "wf_refund",
    organizationId: "org_picx",
    name: "Refund Review",
    trigger: "Refund request",
    destination: "Finance review",
    enabled: false
  },
  {
    id: "wf_api",
    organizationId: "org_northstar",
    name: "API Incident",
    trigger: "API error or rate limit",
    destination: "Developer support",
    enabled: true
  }
];

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo-builder", label: "AI Workspace Builder", icon: Clapperboard },
  { href: "/company-brain", label: "Company Brain", icon: BrainCircuit },
  { href: "/support-chat", label: "AI Chat", icon: Bot },
  { href: "/ai-evaluation", label: "AI Evaluation", icon: FlaskConical },
  { href: "/ai-playground", label: "AI Playground", icon: Microscope },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/ai-improvement", label: "AI Improvement", icon: ClipboardCheck },
  { href: "/knowledge", label: "Knowledge", icon: FileText },
  { href: "/automation", label: "Automation", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/business-impact", label: "Business Impact", icon: CircleDollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin Panel", icon: Building2 }
];

export const foundationItems = [
  { label: "Next.js App", icon: Sparkles },
  { label: "Authentication", icon: Bot },
  { label: "Supabase Boundary", icon: Building2 },
  { label: "Organization System", icon: Building2 },
  { label: "Multi-tenancy", icon: Building2 },
  { label: "Routing and Layout", icon: LayoutDashboard }
];
