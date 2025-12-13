import { component$ } from '@builder.io/qwik';
import type { BlockDefinition } from '~/db/schema';

interface TextBlockProps {
  content?: string;
}

export const definition: BlockDefinition = {
  name: 'Text Content',
  componentType: 'TextBlock',
  category: 'content',
  icon: '📝',
  configSchema: [
    {
      name: 'content',
      label: 'Content (HTML supported)',
      type: 'textarea',
      defaultValue: '<p>Enter your text here...</p>',
      required: true,
    },
  ],
  defaultData: {
    content: '<p>Enter your text here...</p>',
  },
};

export default component$<TextBlockProps>((props) => {
  const { content } = props;

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div
        class="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={content || '<p>Enter your text here...</p>'}
      />
    </div>
  );
});
