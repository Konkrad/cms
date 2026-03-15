type FormPathInput = {
  id: string;
  slug: string;
};

export function buildFormPath(form: FormPathInput): string {
  return `/forms/${form.id}-${form.slug}`;
}
