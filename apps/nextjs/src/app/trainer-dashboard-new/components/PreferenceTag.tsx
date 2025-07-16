import { Icon } from "@acme/ui-shared";
import type { TagColor, SelectOption } from '../types';
import { TAG_COLOR_CLASSES } from '../constants';
import { getOptionLabel } from '../utils';

interface PreferenceTagProps {
  values: string[];
  options: SelectOption[];
  label: string;
  tagColor: TagColor;
  onRemove?: (value: string) => void;
}

export function PreferenceTag({ 
  values, 
  options, 
  label, 
  tagColor,
  onRemove 
}: PreferenceTagProps) {
  if (values.length === 0) return null;

  return (
    <div>
      <span className="text-gray-600">{label}:</span>
      <div className="flex flex-wrap gap-2 mt-1">
        {values.map((value) => (
          <span
            key={value}
            className={`inline-flex items-center px-2 py-1 rounded text-xs ${TAG_COLOR_CLASSES[tagColor]}`}
          >
            {getOptionLabel(value, options)}
            {onRemove && (
              <button
                onClick={() => onRemove(value)}
                className="ml-2 hover:opacity-70"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}