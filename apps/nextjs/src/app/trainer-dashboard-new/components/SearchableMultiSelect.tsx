import { useState, useRef, useEffect } from "react";
import { Icon } from "@acme/ui-shared";
import type { SelectOption, TagColor } from '../types';
import { TAG_COLOR_CLASSES } from '../constants';

interface SearchableMultiSelectProps {
  options: SelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  tagColor?: TagColor;
  dropdownDirection?: 'up' | 'down';
}

export function SearchableMultiSelect({ 
  options, 
  selected, 
  onChange, 
  placeholder = "Type to search...",
  tagColor = "indigo",
  dropdownDirection = "down"
}: SearchableMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase()) &&
    !selected.includes(option.value)
  );

  const handleSelect = (value: string) => {
    onChange([...selected, value]);
    setSearch("");
    setIsOpen(false);
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter(v => v !== value));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <div className={`absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto ${
          dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map((value) => {
            const option = options.find(o => o.value === value);
            return (
              <span
                key={value}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${TAG_COLOR_CLASSES[tagColor]}`}
              >
                {option?.label || value}
                <button
                  onClick={() => handleRemove(value)}
                  className="ml-2 hover:opacity-70"
                >
                  <Icon name="close" size={16} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}