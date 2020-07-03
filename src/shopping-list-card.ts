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
    const items = Object.values(this._items);
    const activeItems = items.filter((item) => item.status === 'active');
    const purchasedItems = items.filter((item) => item.status === 'completed');

    return html`
      <ha-card .header=${this._config.name} tabindex="-1" aria-label=${`${this._config.entity}`}>
        <div class="ha-card-body">
          <section>
            <paper-input
              id="newItem"
              tabindex="-1"
              @keydown="${this._handleNewItemKeyDown}"
              .value="${this._newItemValue}"
            ></paper-input>
            <ha-icon-button icon="mdi:plus" @click="${this._handleNewItemClick}"></ha-icon-button>
          </section>
          <section>
            <div role="listbox">
              ${activeItems.map(
                (item) => html`
                  ${item.id && this._editable[item.id]
                    ? html` <div>
                        <paper-input
                          class="field"
                          label="Item"
                          tabindex="-1"
                          required
                          .id="Item-${item.id}"
                          auto-validate
                          error-message="leaving empty will cancel the edit"
                          .value="${item.value}"
                          @change="${this._handleValueChange(item)}"
                          @keydown="${this.handleValueKeydownChange(item)}"
                        ></paper-input>
                        ${item.id
                          ? html`<ha-icon-button
                              icon="mdi:check"
                              @click="${this._handleAncillaryClick(item)}"
                            ></ha-icon-button>`
                          : ''}
                      </div>`
                    : html`<paper-item
                        @mousedown="${this._handleStartEditClick(item)}"
                        @touchstart="${this._handleStartEditClick(item)}"
                        @mouseout="${this._handleCancelEdit}"
                        @touchend="${this._handleCancelEdit}"
                        @touchleave="${this._handleCancelEdit}"
                        @touchcancel="${this._handleCancelEdit}"
                        @click="${this._handleItemClick(item)}"
                        .disabled="${item.id && this._editable[item.id]}"
                      >
                        <ha-icon icon="mdi:checkbox-blank-outline" class="checkbox"></ha-icon>
                        <paper-item-body>${item.value}</paper-item-body>
                        ${item.id
                          ? html`<ha-icon-button
                              icon="mdi:delete"
                              @click="${this._handleAncillaryClick(item)}"
                            ></ha-icon-button>`
                          : ''}
                      </paper-item>`}
                `,
              )}
            </div>
          </section>
          <section>
            <header>
              <h2>Purchased</h2>
            </header>
            <div role="listbox">
              ${purchasedItems.map(
                (item) => html` <paper-item
                  @mousedown="${this._handleStartEditClick(item)}"
                  @touchstart="${this._handleStartEditClick(item)}"
                  @mouseout="${this._handleCancelEdit}"
                  @touchend="${this._handleCancelEdit}"
                  @touchleave="${this._handleCancelEdit}"
                  @touchcancel="${this._handleCancelEdit}"
                  @click="${this._handleItemClick(item)}"
                  .disabled="${item.id && this._editable[item.id]}"
                  data-completed="true"
                >
                  <ha-icon icon="mdi:checkbox-marked" class="checkbox"></ha-icon>
                  <paper-item-body>${item.value}</paper-item-body>
                  <ha-icon-button disabled icon="mdi:delete-off"></ha-icon-button>
                </paper-item>`,
              )}
            </div>
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
    return async (): Promise<void> => {
      const status = item.status === 'active' ? 'completed' : 'active';
      await this._updateList({ ...item, status });
      this.requestUpdate();
    };
  }

  private _handleValueChange(item: ShoppingListItem) {
    return async (evt): Promise<void> => {
      if (evt.target.value == '' || !item.id) {
        return;
      }
      this._items[item.id].value = _.startCase(evt.target.value);
    };
  }

  private handleValueKeydownChange(item: ShoppingListItem) {
    return async (evt): Promise<void> => {
      if (evt.target.value !== '' && item.id && evt.keyCode === 13) {
        this._items[item.id].value = _.startCase(evt.target.value);
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
    return (): void => {
      if (!!this._editPressTimer) {
        clearTimeout(this._editPressTimer);
        this._editPressTimer = undefined;
      }

      // if (this._longPress && item.id) {
      //   this._handleEnableEdit(item.id, true)();
      //   return;
      // }
      this._handleStatusChange(item)();
    };
  }

  private _handleAncillaryClick(item: ShoppingListItem) {
    return async (evt): Promise<void> => {
      evt.stopPropagation();
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
    const value = _.startCase(this._newItemValue);
    const matchedItem = Object.values(this._items).find((item) => item.value === value);
    if (matchedItem && matchedItem.id) {
      this._items[matchedItem.id].status = 'active';
    } else {
      await this._updateList({ value, status: 'active' });
    }
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
        padding: 0;
      }
      section:first-child {
        display: flex;
        flex-direction: row;
        padding-right: 16px;
      }
      section paper-input {
        flex: 1;
        margin: 16px 16px 16px 24px;
      }
      .section-heading {
        margin: 0;
        padding: 0 8px;
      }
      section > header {
        border-top: 2px solid gray;
        padding: 24px 16px 16px;
        margin: 0 16px;
      }
      [role='listbox'] > * {
        display: flex;
        flex-direction: row;
        padding-right: 16px;
        align-items: center;
      }
      paper-item {
        padding: 16px 16px 16px 24px;
        border-bottom: 1px solid lightgray;
      }
      paper-item:last-child {
        border-bottom: 1px solid rgba(0, 0, 0, 0);
      }
      paper-item-body {
        flex: 1;
        font-size: 20px;
      }
      paper-item ha-icon {
        --mdc-icon-size: 32px;
        padding-right: 24px;
      }
      paper-item[data-completed='true'] {
        color: lightgray;
      }
    `;
  }
}
