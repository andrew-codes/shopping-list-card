import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
import { HomeAssistant, LovelaceCardEditor, getLovelace, LovelaceCard } from 'custom-card-helpers';
import './editor';
import _ from 'lodash';
import { ShoppingListCardConfig, ShoppingListItem } from './types';
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
  connectedCallback(): void {
    super.connectedCallback();
    this._fetchItems();
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('shopping-list-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {};
  }

  @property() public hass!: HomeAssistant;
  @property() private _config!: ShoppingListCardConfig;
  @property() private _listId!: string;
  @property() private _newItemValue = '';
  @property() private _items: { [key: string]: ShoppingListItem } = {};
  @property() private _editable: { [key: string]: boolean } = {};
  private _editPressTimer?: NodeJS.Timeout;
  private _longPress = false;

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

  protected shouldUpdate(): boolean {
    return true;
  }

  updated(changedProperties: PropertyValues): void {
    if (!this.shadowRoot) {
      return;
    }
    if (changedProperties.has('focused') && !changedProperties.has('hass')) {
      const focusedItemId = changedProperties.get('focused') as string;
      if (focusedItemId === 'newItem') {
        this._newItemValue = '';
      }
      const itemToFocus = this.shadowRoot.getElementById(`Item-${focusedItemId}`);
      if (!itemToFocus) {
        return;
      }
      setTimeout(() => {
        itemToFocus.focus();
      }, 0);
    }
  }

  protected render(): TemplateResult | void {
    if (this._config.show_warning) {
      return this.showWarning(localize('common.show_warning'));
    }
    this._listId = this.hass.states[this._config.entity].state;

    return html`
      <ha-card .header=${this._config.name} tabindex="0" aria-label=${`${this._config.entity}`}>
        <div class="ha-card-body">
          <section>
            <paper-input
              id="newItem"
              tabindex="0"
              @keydown="${this._handleNewItemKeyDown}"
              .value="${this._newItemValue}"
            ></paper-input>
            <ha-icon-button icon="mdi:plus" @click="${this._handleNewItemClick}"></ha-icon-button>
          </section>
          <section>
            <ul class="list">
              ${Object.values(this._items).map(
                (item) =>
                  html` <li>
                    ${item.id && this._editable[item.id]
                      ? html`<paper-input
                          class="field"
                          label="Item"
                          tabindex="0"
                          required
                          .id="Item-${item.id}"
                          auto-validate
                          error-message="leaving empty will cancel the edit"
                          .value="${item.value}"
                          @change="${this._handleValueChange(item)}"
                          @keydown="${this.handleValueKeydownChange(item)}"
                        ></paper-input>`
                      : html`<paper-checkbox
                          class="field"
                          .checked="${item.status === 'completed'}"
                          @mousedown="${this._handleStartEditClick(item)}"
                          @touchstart="${this._handleStartEditClick(item)}"
                          @mouseout="${this._handleCancelEdit}"
                          @touchend="${this._handleCancelEdit}"
                          @touchleave="${this._handleCancelEdit}"
                          @touchcancel="${this._handleCancelEdit}"
                          @click="${this._handleItemClick(item)}"
                          .disabled="${item.id && this._editable[item.id]}"
                        >
                          ${item.value}
                        </paper-checkbox>`}
                    ${item.id
                      ? html`<ha-icon-button
                          .icon="${this._editable[item.id]
                            ? 'mdi:check'
                            : item.status === 'active'
                            ? 'mdi:delete'
                            : 'mdi:delete-off'}"
                          .disabled="${item.status !== 'active' && !this._editable[item.id]}"
                          @click="${this._handleAncillaryClick(item)}"
                        ></ha-icon-button>`
                      : ''}
                  </li>`,
              )}
            </ul>
          </section>
        </div>
      </ha-card>
    `;
  }

  private async _handleNewItemClick(): Promise<void> {
    await this._addItem();
  }

  private async _handleNewItemKeyDown(evt): Promise<void> {
    this._newItemValue = evt.target.value;
    if (evt.keyCode === 13) {
      await this._addItem();
    }
  }

  private _handleEnableEdit(id: string, enabled: boolean) {
    return (): void => {
      this._editable[id] = enabled;

      if (!enabled) {
        this._updateList(this._items[id]);
        this.requestUpdate();
        return;
      }
      this.requestUpdate('focused', id);
    };
  }

  private _handleStatusChange(item: ShoppingListItem) {
    return async (evt): Promise<void> => {
      const status = evt.target.checked ? 'completed' : 'active';
      await this._updateList({ ...item, status });
      this.requestUpdate();
    };
  }

  private _handleValueChange(item: ShoppingListItem) {
    return async (evt): Promise<void> => {
      if (evt.target.value == '' || !item.id) {
        return;
      }
      this._items[item.id].value = evt.target.value;
    };
  }

  private handleValueKeydownChange(item: ShoppingListItem) {
    return async (evt): Promise<void> => {
      if (evt.target.value !== '' && item.id && evt.keyCode === 13) {
        this._items[item.id].value = evt.target.value;
        this._handleEnableEdit(item.id, false)();
      }
    };
  }

  private _handleStartEditClick(item: ShoppingListItem) {
    return (evt): void => {
      if (evt.type === 'click' && evt.button !== 0) {
        return;
      }
      this._longPress = false;
      if (!this._editPressTimer) {
        this._editPressTimer = setTimeout(() => {
          this._longPress = true;
          if (!item.id) {
            return;
          }
          this._handleEnableEdit(item.id, true)();
        }, 1000);
      }
    };
  }

  private _handleCancelEdit(): void {
    if (!!this._editPressTimer) {
      clearTimeout(this._editPressTimer);
      this._editPressTimer = undefined;
    }
  }

  private _handleItemClick(item: ShoppingListItem) {
    return (evt): void => {
      if (!!this._editPressTimer) {
        clearTimeout(this._editPressTimer);
        this._editPressTimer = undefined;
      }

      // if (this._longPress && item.id) {
      //   this._handleEnableEdit(item.id, true)();
      //   return;
      // }
      this._handleStatusChange(item)(evt);
    };
  }

  private _handleAncillaryClick(item: ShoppingListItem) {
    return async (): Promise<void> => {
      if (item.id && this._editable[item.id]) {
        this._handleEnableEdit(item.id, false)();
      } else {
        await this._deleteItem(item);
      }
    };
  }

  private async _fetchItems(): Promise<void> {
    const response = await fetch(this._config.api_url, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ primaryShoppingList { id items { id status value } } }',
      }),
    });
    const {
      data: { primaryShoppingList },
    } = await response.json();
    this._items = _.keyBy(primaryShoppingList.items, 'id');
  }

  private async _updateList(item: ShoppingListItem): Promise<void> {
    const response = await fetch(this._config.api_url, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          'mutation updateShoppingListItems($list: InputListItemUpdate!) { updateShoppingListItems(list: $list) { id value status } }',
        variables: {
          list: {
            id: this._listId,
            items: [item],
          },
        },
      }),
    });
    const json = await response.json();
    this._items[json.data.updateShoppingListItems[0].id] = {
      id: json.data.updateShoppingListItems[0].id,
      status: json.data.updateShoppingListItems[0].status,
      value: json.data.updateShoppingListItems[0].value,
    };
  }

  private async _deleteItem(item: ShoppingListItem): Promise<void> {
    if (!item.id) {
      return;
    }
    const response = await fetch(this._config.api_url, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          'mutation deleteShoppingListItems($items: [InputListItem!]!) { deleteShoppingListItems(items: $items) { id } }',
        variables: {
          items: [item],
        },
      }),
    });
    const json = await response.json();
    console.log(json);
    delete this._items[item.id];
    this.requestUpdate();
  }

  private async _addItem(): Promise<void> {
    if (!this._newItemValue || this._newItemValue === '') {
      return;
    }
    const value = this._newItemValue;
    await this._updateList({ value, status: 'active' });
    this.requestUpdate('focused', 'newItem');
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
      .ha-card-body {
        padding: 0 16px;
      }
      section:first-child {
        display: flex;
        flex-direction: row;
      }
      section:first-child paper-input {
        flex: 1;
      }
      .section-heading {
        margin: 0;
        padding: 0 8px;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .list > li {
        display: flex;
        flex-direction: row;
        border-bottom: 1px solid lightgray;
      }
      .list li ha-icon-button {
        align-self: center;
        color: gray;
      }
      .list li paper-checkbox {
        --paper-checkbox-label-spacing: 16px;
        --paper-checkbox-size: 24px;
      }
      .list li .field {
        box-sizing: border-box;
        font-size: 20px;
        padding: 24px 24px 24px 32px;
        flex: 1;
      }
    `;
  }
}
