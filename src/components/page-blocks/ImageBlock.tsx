import { component$ } from '@builder.io/qwik';
import type { BlockDefinition } from '~/db/schema';

interface ImageBlockProps {
  src?: string;
  alt?: string;
  caption?: string;
}

export const definition: BlockDefinition = {
  name: 'Image',
  componentType: 'ImageBlock',
  category: 'content',
  icon: '🖼️',
  configSchema: [
    {
      name: 'src',
      label: 'Image URL',
      type: 'url',
      defaultValue: 'https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg',
      required: true,
      placeholder: 'https://example.com/image.jpg',
    },
    {
      name: 'alt',
      label: 'Alt Text',
      type: 'text',
      defaultValue: 'Image description',
      required: true,
    },
    {
      name: 'caption',
      label: 'Caption',
      type: 'text',
      placeholder: 'Optional caption',
    },
  ],
  defaultData: {
    src: 'https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg',
    alt: 'Image description',
    caption: '',
  },
};

export default component$<ImageBlockProps>((props) => {
  const { src, alt, caption } = props;

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <figure>
        <img
          src={src || 'https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg'}
          alt={alt || 'Image'}
          class="w-full rounded-lg shadow-lg"
        />
        {caption && (
          <figcaption class="mt-3 text-center text-gray-600 text-sm">{caption}</figcaption>
        )}
      </figure>
    </div>
  );
});
