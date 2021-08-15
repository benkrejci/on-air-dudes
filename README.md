# on-air-dudes

Show on air statuses on led-dudes lights

This is just a controller which uses [@benkrejci/on-air](https://github.com/benkrejci/on-air) bonjour service to control [@benkrejci/led-dudes](https://github.com/benkrejci/led-dudes) lights

## Usage

Example:

```sh
node dist/run.js node_modules/@benkrejci/on-air/config/config.example.yml node_modules/@benkrejci/led-dudes/config/gold-dotstar.yml
```