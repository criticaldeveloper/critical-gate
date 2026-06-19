export type FrameworkPackId =
  | "react"
  | "next"
  | "angular"
  | "astro"
  | "lit"
  | "nest"
  | "express"
  | "vite"
  | "storybook";

export interface FrameworkCompanionRule {
  id: string;
  whenChanged: string;
  expectAny: string[];
  reason: string;
}

export interface FrameworkPack {
  id: FrameworkPackId;
  label: string;
  packageHints: string[];
  fileHints: string[];
  companionRules: FrameworkCompanionRule[];
}
