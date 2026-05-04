import type { DEFAULT_TARGETS } from "./constants.js";

export type Target = (typeof DEFAULT_TARGETS)[number];
export type Status = "pass" | "warn" | "fail";
export type ApiMode = "responses" | "chat" | "anthropic";

export interface SetupContext {
  baseUrl: string;
  apiKey: string;
  model: string;
  dryRun: boolean;
  yes: boolean;
  homeDir: string;
  network: boolean;
  allowNativeHermes?: boolean;
  claudeCodeModel?: string;
}

export interface ApplyResult {
  target: Target;
  status: Status;
  path: string;
  message: string;
  backupPath?: string;
  apiMode?: ApiMode;
}

export interface CheckContext {
  expectedBaseUrl?: string;
  apiKey?: string;
  model?: string;
  homeDir: string;
  network: boolean;
}

export interface CheckResult {
  target: Target;
  status: Status;
  path: string;
  message: string;
  baseUrl?: string;
  model?: string;
  authSource?: string;
  apiMode?: ApiMode;
  details?: string[];
}

export interface Adapter {
  target: Target;
  setup(context: SetupContext): Promise<ApplyResult>;
  check(context: CheckContext): Promise<CheckResult>;
}
