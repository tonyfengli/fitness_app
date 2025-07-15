export interface Client {
  id: string;
  name: string;
  avatar?: string;
  program: string;
  isSelected?: boolean;
}

export interface ClientSidebarProps {
  clients: Client[];
  selectedClientId?: string;
  onClientSelect?: (client: Client) => void;
  onAddNewClient?: () => void;
  className?: string;
  // Search and filter props - reserved for future use
  onSearch?: (query: string) => void;
  searchQuery?: string;
  filters?: {
    gender?: string[];
    age?: string[];
  };
  onFilterChange?: (filterType: 'gender' | 'age', value: string) => void;
}