import type { FrameworkPack } from "./types.js";

export const frameworkPacks: FrameworkPack[] = [
  {
    id: "react",
    label: "React",
    packageHints: ["react", "react-dom"],
    fileHints: [],
    companionRules: [
      {
        id: "react-component-test",
        whenChanged: "src/**/*.tsx",
        expectAny: ["src/**/*.test.tsx", "src/**/*.spec.tsx"],
        reason: "React component changes often need matching component tests."
      }
    ]
  },
  {
    id: "next",
    label: "Next.js",
    packageHints: ["next"],
    fileHints: ["next.config.js", "next.config.mjs", "next.config.ts"],
    companionRules: [
      {
        id: "next-page-route-support",
        whenChanged: "app/**/page.tsx",
        expectAny: ["app/**/route.ts", "app/**/actions.ts", "messages/**/*.json"],
        reason:
          "Next.js page changes commonly pair with route handlers, server actions, or messages."
      }
    ]
  },
  {
    id: "angular",
    label: "Angular",
    packageHints: ["@angular/core"],
    fileHints: ["angular.json"],
    companionRules: [
      {
        id: "angular-component-companions",
        whenChanged: "src/**/*.component.ts",
        expectAny: [
          "src/**/*.component.html",
          "src/**/*.component.scss",
          "src/**/*.component.css",
          "src/**/*.component.spec.ts"
        ],
        reason:
          "Angular component TypeScript changes often pair with template, style, or spec files."
      }
    ]
  },
  {
    id: "astro",
    label: "Astro",
    packageHints: ["astro"],
    fileHints: ["astro.config.mjs", "astro.config.ts"],
    companionRules: [
      {
        id: "astro-component-style",
        whenChanged: "src/**/*.astro",
        expectAny: ["src/**/*.scss", "src/**/*.css", "src/**/*.ts"],
        reason: "Astro component changes often pair with styles or client-side scripts."
      }
    ]
  },
  {
    id: "lit",
    label: "Lit",
    packageHints: ["lit", "lit-element"],
    fileHints: [],
    companionRules: [
      {
        id: "lit-component-companions",
        whenChanged: "src/**/*.ts",
        expectAny: ["src/**/*.styles.ts", "src/**/*.stories.ts", "custom-elements.json"],
        reason:
          "Lit component changes often pair with styles, stories, or custom-elements metadata."
      }
    ]
  },
  {
    id: "nest",
    label: "NestJS",
    packageHints: ["@nestjs/core"],
    fileHints: ["nest-cli.json"],
    companionRules: [
      {
        id: "nest-service-spec",
        whenChanged: "src/**/*.service.ts",
        expectAny: ["src/**/*.service.spec.ts", "src/**/*.controller.ts", "src/**/*.module.ts"],
        reason: "Nest service changes often pair with specs, controllers, or module wiring."
      }
    ]
  },
  {
    id: "express",
    label: "Express",
    packageHints: ["express"],
    fileHints: [],
    companionRules: [
      {
        id: "express-route-test",
        whenChanged: "src/**/*route*.ts",
        expectAny: ["src/**/*.test.ts", "tests/**/*.test.ts"],
        reason: "Express route changes should usually have request/handler tests."
      }
    ]
  },
  {
    id: "vite",
    label: "Vite",
    packageHints: ["vite"],
    fileHints: ["vite.config.ts", "vite.config.js", "vite.config.mjs"],
    companionRules: [
      {
        id: "vite-config-docs",
        whenChanged: "vite.config.*",
        expectAny: ["README.md", "docs/**/*.md"],
        reason: "Vite build configuration changes may need visible setup documentation."
      }
    ]
  },
  {
    id: "storybook",
    label: "Storybook",
    packageHints: ["storybook", "@storybook/react", "@storybook/angular", "@storybook/addon-docs"],
    fileHints: [".storybook/main.ts", ".storybook/main.js"],
    companionRules: [
      {
        id: "storybook-component-story",
        whenChanged: "src/**/*.tsx",
        expectAny: ["src/**/*.stories.tsx", "src/**/*.mdx"],
        reason: "Component changes in Storybook repositories often need stories or MDX docs."
      }
    ]
  }
];
