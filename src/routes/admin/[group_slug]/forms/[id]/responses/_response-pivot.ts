type QuestionDefinition = {
  key: string;
  label: string;
};

function extractQuestionsFromSurvey(schemaJson: Record<string, any>): QuestionDefinition[] {
  const pages = Array.isArray(schemaJson?.pages) ? schemaJson.pages : [];
  const questions: QuestionDefinition[] = [];

  for (const page of pages) {
    const elements = Array.isArray(page?.elements) ? page.elements : [];
    for (const element of elements) {
      const key = typeof element?.name === "string" ? element.name.trim() : "";
      if (!key) {
        continue;
      }

      const labelRaw = typeof element?.title === "string" ? element.title.trim() : "";
      questions.push({
        key,
        label: labelRaw || key,
      });
    }
  }

  return questions;
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatAnswer(item)).join(", ");
  }

  return JSON.stringify(value);
}

export function buildResponseColumns(
  schemaJson: Record<string, any>,
  responses: Array<{ resultJson: Record<string, any> }>,
): QuestionDefinition[] {
  const schemaQuestions = extractQuestionsFromSurvey(schemaJson);
  const knownKeys = new Set(schemaQuestions.map((question) => question.key));
  const columns = [...schemaQuestions];

  // Keep schema order first, then append unknown keys found in stored submissions.
  for (const response of responses) {
    const entries = Object.entries(response.resultJson || {});
    for (const [key] of entries) {
      if (!knownKeys.has(key)) {
        knownKeys.add(key);
        columns.push({ key, label: key });
      }
    }
  }

  return columns;
}

export function getAnswerValue(resultJson: Record<string, any>, key: string): string {
  return formatAnswer(resultJson?.[key]);
}
