export interface Template {
  id: string;
  name: string;
  description: string;
  icon?: string;
  modules: string[];
  fieldMappings?: Record<string, string>;
  defaultSelectors?: Record<string, string | string[]>;
  filterPresets?: Record<string, any>;
  exampleUrls?: string[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'products',
    name: 'Scrape Products',
    description: 'Extract product listings with title, price, image, and description',
    modules: ['products', 'images'],
    fieldMappings: {
      title: 'title',
      price: 'price',
      image: 'image',
      description: 'description',
      url: 'link',
    },
    defaultSelectors: {
      title: ['h1.product-title', '.product-name', '[data-product-title]'],
      price: ['.price', '[data-price]', '.product-price'],
      image: ['.product-image img', 'img.product-photo', '[data-product-image]'],
      description: ['.description', '.product-details', '[data-product-description]'],
    },
    filterPresets: {
      hasImage: true,
      hasPrice: true,
    },
    exampleUrls: [
      'https://example-store.com/products',
      'https://shop.example.com/collections/all',
    ],
  },
  {
    id: 'menu',
    name: 'Scrape Menu',
    description: 'Extract restaurant menu items with names, prices, and descriptions',
    modules: ['products', 'text'],
    fieldMappings: {
      name: 'title',
      price: 'price',
      description: 'description',
    },
    defaultSelectors: {
      name: ['.menu-item-name', '.dish-name', 'h3.menu-item'],
      price: ['.menu-item-price', '.price', '[data-price]'],
      description: ['.menu-item-description', '.dish-description'],
    },
    exampleUrls: [
      'https://restaurant.example.com/menu',
    ],
  },
  {
    id: 'contacts',
    name: 'Scrape Contacts',
    description: 'Extract emails, phone numbers, and social media links',
    modules: ['contacts'],
    fieldMappings: {},
    exampleUrls: [
      'https://company.example.com/contact',
      'https://example.com/about',
    ],
  },
  {
    id: 'real-estate',
    name: 'Scrape Real Estate',
    description: 'Extract property listings with details, prices, and images',
    modules: ['products', 'images', 'text'],
    fieldMappings: {
      address: 'title',
      price: 'price',
      images: 'image',
      details: 'description',
    },
    defaultSelectors: {
      address: ['.property-address', '.listing-address', 'h1.address'],
      price: ['.property-price', '.listing-price', '[data-price]'],
      images: ['.property-image img', '.listing-photo img'],
      details: ['.property-details', '.listing-description'],
    },
    exampleUrls: [
      'https://realestate.example.com/listings',
    ],
  },
  {
    id: 'blog',
    name: 'Scrape Blog Posts',
    description: 'Extract blog articles with titles, content, and dates',
    modules: ['text', 'images'],
    fieldMappings: {
      title: 'title',
      content: 'paragraphs',
      date: 'meta',
    },
    exampleUrls: [
      'https://blog.example.com',
      'https://example.com/articles',
    ],
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplateByModules(modules: string[]): Template | undefined {
  return TEMPLATES.find(t => 
    t.modules.every(m => modules.includes(m)) && 
    modules.every(m => t.modules.includes(m))
  );
}
