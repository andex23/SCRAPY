'use client';

interface ModuleSelectorProps {
  selected: string[];
  onChange: (modules: string[]) => void;
  disabled?: boolean;
}

const MODULES = [
  { id: 'images', label: 'images' },
  { id: 'videos', label: 'videos' },
  { id: 'text', label: 'text' },
  { id: 'products', label: 'products' },
  { id: 'contacts', label: 'contacts' },
  { id: 'assets', label: 'assets' },
  { id: 'crawl', label: 'crawl' },
  { id: 'screenshot', label: 'screenshot' },
];

export default function ModuleSelector({ selected, onChange, disabled }: ModuleSelectorProps) {
  const toggleModule = (moduleId: string) => {
    if (disabled) return;
    
    if (selected.includes(moduleId)) {
      onChange(selected.filter(id => id !== moduleId));
    } else {
      onChange([...selected, moduleId]);
    }
  };

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {MODULES.map((module) => (
        <label
          key={module.id}
          className={`flex items-center gap-2 cursor-pointer transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-foreground'
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(module.id)}
            onChange={() => toggleModule(module.id)}
            disabled={disabled}
            className="w-4 h-4 border border-border bg-background checked:bg-accent cursor-pointer"
          />
          <span className="text-sm text-accent select-none">{module.label}</span>
        </label>
      ))}
    </div>
  );
}
