import type { DiffFile } from "../schema/index.js";

const contentFilePathPattern = /(^|\/)(?:src\/)?content\/.+\.(?:md|mdx)$/i;
const contentPublishTaskPattern =
  /\b(?:publish|add|create|write|draft)\b[\s\S]*\b(?:post|posts|article|articles|content|entry|entries)\b|\b(?:post|posts|article|articles|content|entry|entries)\b[\s\S]*\b(?:publish|add|create|write|draft)\b/i;
const contentMetadataTaskPattern =
  /\b(?:related|synapse|synapses|metadata|frontmatter|front matter|tag|tags|series|reciprocal)\b/i;
const metadataKeyPattern =
  /^\s*(?:related|synapses|tags|series|next|previous|prev):\s*(?:\[.*\])?\s*$/i;
const metadataValuePattern = /^\s*(?:-\s*)?(?:"[^"]+"|'[^']+'|[a-z0-9][a-z0-9/_-]*)\s*,?\s*$/i;

export function isContentPostReciprocalMetadataChange(
  files: DiffFile[],
  taskText: string
): boolean {
  if (
    files.length < 2 ||
    files.length > 12 ||
    !contentPublishTaskPattern.test(taskText) ||
    !contentMetadataTaskPattern.test(taskText) ||
    !files.every(isContentFileChange)
  ) {
    return false;
  }

  const addedContentFiles = files.filter((file) => file.status === "added");
  const modifiedContentFiles = files.filter((file) => file.status === "modified");

  return (
    addedContentFiles.length > 0 &&
    modifiedContentFiles.length > 0 &&
    modifiedContentFiles.every(hasOnlyReciprocalMetadataChanges)
  );
}

function isContentFileChange(file: DiffFile): boolean {
  return file.status !== "deleted" && contentFilePathPattern.test(file.path);
}

function hasOnlyReciprocalMetadataChanges(file: DiffFile): boolean {
  const changedLines = file.hunks
    .flatMap((hunk) => hunk.lines)
    .filter((line) => line.kind === "add" || line.kind === "delete");

  return changedLines.length > 0 && changedLines.every((line) => isMetadataLine(line.content));
}

function isMetadataLine(content: string): boolean {
  const trimmed = content.trim();

  return (
    trimmed.length === 0 ||
    trimmed === "---" ||
    trimmed === "[" ||
    trimmed === "]" ||
    metadataKeyPattern.test(trimmed) ||
    metadataValuePattern.test(trimmed)
  );
}
