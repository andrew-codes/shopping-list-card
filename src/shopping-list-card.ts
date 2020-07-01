import _ from 'lodash';
import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  LovelaceCardEditor,
  getLovelace,
  LovelaceCard,
} from 'custom-card-helpers';
import './editor';

import { ShoppingListCardConfig, ShoppingList, ShoppingListItem } from './types';
import { CARD_VERSION } from './const';

import { localize } from './localize/localize';

/* eslint no-console: 0 */
console.info(
  `%c  shopping-list-card \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'shopping-list-card',
  name: 'Shopping List Card',
  description: 'A shopping list card based on my custom GraphQL backend',
});

@customElement('shopping-list-card')
export class ShoppingListCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('shopping-list-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {};
  }

  @property() public hass!: HomeAssistant;
  @property() private _config!: ShoppingListCardConfig;

  public setConfig(config: ShoppingListCardConfig): void {
    if (!config || config.show_error) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._config = {
      name: 'Shopping List Card',
      ...config,
    };
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    try {
      return hasConfigOrEntityChanged(this, changedProps, false);
    } catch {
      return true;
    }
  }

  protected render(): TemplateResult | void {
    if (this._config.show_warning) {
      return this.showWarning(localize('common.show_warning'));
    }
    const { items } = JSON.parse(
      this.hass.states[this._config.entity].state.toString().replace(/'/g, '"'),
    ) as ShoppingList;

    const itemsByStatus = _.groupBy(items, 'status');
    console.log(itemsByStatus);

    return html`
      <ha-card .header=${this._config.name} tabindex="0" aria-label=${`${this._config.entity}`}>
        ${Object.entries(itemsByStatus).map(
          ([status, items]) =>
            html`<h3>${status}</h3>
              ${(items as Array<ShoppingListItem>).map(
                (item) =>
                  html`<paper-checkbox .checked="${item.status === 'completed'}" @change="${this._handleChange}"
                    >${item.value}</paper-checkbox
                  >`,
              )}`,
        )}
      </ha-card>
    `;
  }

  private _handleChange(evt): void {
    console.log(evt.target.checked);
  }

  private showWarning(warning: string): TemplateResult {
    return html` <hui-warning>${warning}</hui-warning> `;
  }

  private showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card') as LovelaceCard;
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this._config,
    });

    return html` ${errorCard} `;
  }

  static get styles(): CSSResult {
    return css`
      paper-checkbox {
        --paper-checkbox-label-spacing: 16px;
        --paper-checkbox-size: 24px;
        width: 100%;
        font-size: 20px;
        padding: 24px 24px 24px 32px;
      }
    `;
  }
}
