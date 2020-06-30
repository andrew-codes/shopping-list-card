import { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';

export interface BoilerplateCardConfig extends LovelaceCardConfig {
  type: string;
  show_warning?: boolean;
  show_error?: boolean;
  test_gui?: boolean;
  entity: string;
  purchased_action?: ActionConfig;
  mark_needed_action?: ActionConfig;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface ShoppingListItem {
  id: string;
  value: string;
  status: 'active' | 'completed';
}
