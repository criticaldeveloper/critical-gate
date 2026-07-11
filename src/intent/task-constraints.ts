export interface SeparatedTaskText {
  descriptiveText: string;
  constraints: string[];
  inferredInvariants: string[];
  inferredForbiddenPaths: string[];
}

const constraintHeading =
  /^(?:constraints?|invariants?|restrictions?|restricciones?|invariantes?)\s*:\s*/iu;
const constraintMarkers = [
  /\b(?:without|do\s+not|don't|must\s+not|should\s+not|no\s+new|no\s+changes?\s+to)\b/iu,
  /\b(?:sin|no\s+(?:cambiar|modificar|añadir|agregar)|mant(?:én|ener)\b.*?\bsin\s+cambios)\b/iu
];

const invariantPatterns: Array<{ invariant: string; pattern: RegExp }> = [
  {
    invariant: "no_new_dependencies",
    pattern:
      /\b(?:(?:add|adding|introduce|introducing|new)\b.*\bdependenc(?:y|ies)|(?:añadir|agregar|nuevas?)\b.*\bdependencias?)\b/iu
  },
  {
    invariant: "no_public_api_change",
    pattern: /\b(?:public\s+api|public\s+exports?|api\s+pública|exports?\s+públicos?)\b/iu
  },
  {
    invariant: "tests_must_not_weaken",
    pattern: /\b(?:weaken(?:ing)?\s+tests?|debilitar\s+(?:los\s+)?tests?|debilitar\s+pruebas?)\b/iu
  },
  {
    invariant: "no_config_changes",
    pattern:
      /\b(?:chang(?:e|ing)\s+(?:the\s+)?config(?:uration)?|modificar\s+(?:la\s+)?configuración)\b/iu
  },
  {
    invariant: "no_secret_leaks",
    pattern: /\b(?:expos(?:e|ing)\s+secrets?|filtrar\s+secretos?)\b/iu
  },
  {
    invariant: "no_environment_leaks",
    pattern:
      /\b(?:environment(?:-specific)?\s+(?:paths?|values?)|rutas?\s+(?:locales?|de\s+entorno))\b/iu
  }
];

export function separateTaskText(value: string): SeparatedTaskText {
  const descriptiveParts: string[] = [];
  const constraints: string[] = [];

  for (const segment of splitSegments(value)) {
    const headingMatch = constraintHeading.exec(segment);

    if (headingMatch !== null) {
      const constraint = segment.slice(headingMatch[0].length).trim();
      if (constraint.length > 0) constraints.push(constraint);
      continue;
    }

    const markerIndex = findConstraintMarker(segment);

    if (markerIndex === undefined) {
      descriptiveParts.push(segment);
      continue;
    }

    const description = segment
      .slice(0, markerIndex)
      .replace(/\b(?:and|y)\s*$/iu, "")
      .trim();
    const constraint = segment.slice(markerIndex).trim();

    if (description.length > 0) descriptiveParts.push(description);
    if (constraint.length > 0) constraints.push(constraint);
  }

  return {
    descriptiveText: descriptiveParts.join(". ").trim(),
    constraints,
    inferredInvariants: inferInvariants(constraints),
    inferredForbiddenPaths: inferForbiddenPaths(constraints)
  };
}

function splitSegments(value: string): string[] {
  return value
    .normalize("NFC")
    .split(/(?:\r?\n|[!?;]+\s*|\.\s+)/u)
    .map((segment) =>
      segment
        .replace(/^\s*[-*]\s*/, "")
        .replace(/[.!?;]+$/u, "")
        .trim()
    )
    .filter(Boolean);
}

function findConstraintMarker(value: string): number | undefined {
  const indexes = constraintMarkers
    .map((pattern) => pattern.exec(value)?.index)
    .filter((index): index is number => index !== undefined);

  return indexes.length === 0 ? undefined : Math.min(...indexes);
}

function inferInvariants(constraints: string[]): string[] {
  return invariantPatterns
    .filter(({ pattern }) => constraints.some((constraint) => pattern.test(constraint)))
    .map(({ invariant }) => invariant);
}

function inferForbiddenPaths(constraints: string[]): string[] {
  const paths = constraints.flatMap(
    (constraint) =>
      constraint.match(/(?:[\w.-]+\/)+(?:\*\*|[\w.*-]+\.[\w.-]+)|[\w.-]+\.[\w.-]+/gu) ?? []
  );

  return [...new Set(paths.filter((path) => !path.includes("://")))];
}
