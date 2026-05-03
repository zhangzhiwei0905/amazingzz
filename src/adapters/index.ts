import { codexAdapter } from "./codex.js";
import { hermesAdapter } from "./hermes.js";
import { openClawAdapter } from "./openclaw.js";
import type { Adapter, Target } from "../types.js";

export const adapters: Record<Target, Adapter> = {
  codex: codexAdapter,
  openclaw: openClawAdapter,
  hermes: hermesAdapter
};
