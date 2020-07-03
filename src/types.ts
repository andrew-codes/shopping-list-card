import { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';

export interface ShoppingListCardConfig extends LovelaceCardConfig {
  type: string;
  show_warning?: boolean;
  show_error?: boolean;
  test_gui?: boolean;
  entity: string;
  api_url: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: Array<ShoppingListItem>;
}

export interface ShoppingListItem {
  id?: string;
  value: string;
  status: 'active' | 'completed';
}
