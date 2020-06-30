# Shopping List Card

A shopping list Lovelace card using my custom GraphQL backend for obtaining shopping list items.

## Support

There is no support provided. Due to the highly specific nature of this card, I do not think it will server its intended purpose for anyone other than myself.

## Action Options

| Name            | Type   | Requirement  | Description                                                                                                                            | Default     |
| --------------- | ------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| action          | string | **Required** | Action to perform (more-info, toggle, call-service, navigate url, none)                                                                | `more-info` |
| navigation_path | string | **Optional** | Path to navigate to (e.g. /lovelace/0/) when action defined as navigate                                                                | `none`      |
| url             | string | **Optional** | URL to open on click when action is url. The URL will open in a new tab                                                                | `none`      |
| service         | string | **Optional** | Service to call (e.g. media_player.media_play_pause) when action defined as call-service                                               | `none`      |
| service_data    | object | **Optional** | Service data to include (e.g. entity_id: media_player.bedroom) when action defined as call-service                                     | `none`      |
| haptic          | string | **Optional** | Haptic feedback for the [Beta IOS App](http://home-assistant.io/ios/beta) _success, warning, failure, light, medium, heavy, selection_ | `none`      |
| repeat          | number | **Optional** | How often to repeat the `hold_action` in milliseconds.                                                                                 | `non`       |

## Starting a new card from shopping-list-card with [devcontainer][devcontainer]

Note: this is available only in vscode ensure you have the [Remote Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed.

1. Fork and clone the repository.
2. Open a [devcontainer][devcontainer] terminal and run `npm start` when it's ready.
3. The compiled `.js` file will be accessible on
   `http://127.0.0.1:5000/shopping-list-card.js`.
4. On a running Home Assistant installation add this to your Lovelace
   `resources:`

```yaml
- url: 'http://127.0.0.1:5000/shopping-list-card.js'
  type: module
```

_Change "127.0.0.1" to the IP of your development machine._

### Bonus

If you need a fresh test instance you can install a fresh Home Assistant instance inside the devcontainer as well.

1. Run the command `dc start`.
2. Home Assistant will install and will eventually be running on port `9123`
