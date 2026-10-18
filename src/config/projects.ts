import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { Cron } from "croner";

export const TrackedEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  label: z.string().optional(),
});

export type TrackedEvent = z.infer<typeof TrackedEventSchema>;

export const UtmBreakdownSchema = z.object({
  source: z.string().min(1, "UTM source is required"),
  dimensions: z.array(z.string()).default(["utmContent"]),
});

export type UtmBreakdown = z.infer<typeof UtmBreakdownSchema>;

function isValidCronPattern(pattern: string): boolean {
  try {
    new Cron(pattern);
    return true;
  } catch {
    return false;
  }
}

export const ScheduleConfigSchema = z.object({
  enabled: z.boolean().default(false),
  cron: z
    .string()
    .default("0 9 * * *")
    .refine(isValidCronPattern, { message: "Invalid cron expression format" }),
  period: z.enum(["yesterday", "today", "24h", "7d", "30d"]).default("yesterday"),
});

export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;

function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const ProjectConfigSchema = z.object({
  id: z.string().min(1, "Project id is required").regex(/^[a-z0-9_-]+$/, "Project id must be alphanumeric with dashes/underscores"),
  name: z.string().min(1, "Project display name is required"),
  telegramChatId: z.coerce.number().int("telegramChatId must be an integer"),
  umamiWebsiteId: z.string().min(1, "umamiWebsiteId is required"),
  timezone: z
    .string()
    .default("Asia/Tehran")
    .refine(isValidIanaTimezone, { message: "Invalid IANA timezone identifier" }),
  schedule: ScheduleConfigSchema.default({
    enabled: false,
    cron: "0 9 * * *",
    period: "yesterday",
  }),
  trackedEvents: z.array(TrackedEventSchema).default([]),
  utmBreakdowns: z.array(UtmBreakdownSchema).default([]),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const ProjectsConfigSchema = z.array(ProjectConfigSchema).min(1, "At least one project must be configured");

export class ProjectRegistry {
  private projects: ProjectConfig[] = [];
  private chatMap: Map<number, ProjectConfig> = new Map();
  private idMap: Map<string, ProjectConfig> = new Map();

  constructor(projects: ProjectConfig[]) {
    this.setProjects(projects);
  }

  public setProjects(projects: ProjectConfig[]): void {
    this.projects = projects;
    this.chatMap.clear();
    this.idMap.clear();

    for (const project of projects) {
      this.chatMap.set(project.telegramChatId, project);
      this.idMap.set(project.id, project);
    }
  }

  public getAll(): ProjectConfig[] {
    return this.projects;
  }

  public findByChatId(chatId: number): ProjectConfig | undefined {
    return this.chatMap.get(chatId);
  }

  public findById(id: string): ProjectConfig | undefined {
    return this.idMap.get(id);
  }

  public isAuthorizedChat(chatId: number): boolean {
    return this.chatMap.has(chatId);
  }
}

let cachedRegistry: ProjectRegistry | null = null;

export function loadProjects(configPath: string): ProjectRegistry {
  if (!existsSync(configPath)) {
    throw new Error(`Project configuration file not found at path: ${configPath}`);
  }

  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(`Failed to read project configuration file: ${(err as Error).message}`);
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid JSON in project configuration file (${configPath}): ${(err as Error).message}`);
  }

  const parsed = ProjectsConfigSchema.safeParse(rawJson);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => ` - [${issue.path.join(".")}]: ${issue.message}`)
      .join("\n");
    throw new Error(`Project configuration validation failed for ${configPath}:\n${errorMessages}`);
  }

  // Check for duplicate telegramChatId or id
  const seenChatIds = new Set<number>();
  const seenIds = new Set<string>();

  for (const proj of parsed.data) {
    if (seenChatIds.has(proj.telegramChatId)) {
      throw new Error(`Duplicate telegramChatId detected in configuration: ${proj.telegramChatId}`);
    }
    seenChatIds.add(proj.telegramChatId);

    if (seenIds.has(proj.id)) {
      throw new Error(`Duplicate project id detected in configuration: "${proj.id}"`);
    }
    seenIds.add(proj.id);
  }

  cachedRegistry = new ProjectRegistry(parsed.data);
  return cachedRegistry;
}

export function getProjectRegistry(): ProjectRegistry {
  if (!cachedRegistry) {
    throw new Error("Project registry has not been initialized. Call loadProjects() first.");
  }
  return cachedRegistry;
}

export function resetProjectRegistryCache(): void {
  cachedRegistry = null;
}
