# Rabbit Relay RPC

A small promise-based RPC layer for Node.js services communicating through RabbitMQ. Provides a simple request-response API with minimal boilerplate.

## Requirements

- Node.js 22 or newer
- RabbitMQ

## Installation

```sh
npm install @slpxxv/rabbit-relay-rpc
```

## Quick start

```js
const createDispatcher = require('@slpxxv/rabbit-relay-rpc')

async function main () {
  const rpc = await createDispatcher('amqp://localhost', {
    commandQueue: 'commands',
    timeoutMs: 10_000,
    prefetch: 20
  })

  rpc.register('greet', user => `Hello ${user}`)
  await rpc.start()

  const greeting = await rpc.call('greet', 'John')
  console.log(greeting)

  await rpc.close()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
```

Register handlers before calling `start()`. A dispatcher can act as both a client and
a server, or only use the methods needed by a service. Handler return values are JSON
serialized and remote handler failures reject the corresponding `call()` promise.

## API

### `createDispatcher(url[, options])`

Connects to RabbitMQ and returns a dispatcher. Supported options:

| Option | Default | Description |
| --- | --- | --- |
| `commandQueue` | `commands` | Queue used for RPC requests |
| `timeoutMs` | `60000` | Maximum time to wait for a response |
| `prefetch` | unset | Maximum unacknowledged requests per consumer |

### `register(name, handler)`

Registers a synchronous or asynchronous handler under a non-empty name.

### `start()`

Starts consuming requests. Repeated calls are safe and do not create extra consumers.

### `call(name, ...args)`

Calls a remote handler and resolves with its deserialized return value. It rejects on
timeouts, malformed responses, unknown handlers, and errors thrown by handlers.

### `close()`

Closes both channels and the RabbitMQ connection. Pending calls are rejected.

## Development

```sh
npm install
npm run check
```

The project uses Node.js' built-in test runner and JavaScript Standard Style.

## Publishing

Publishing is handled by GitHub Actions when a non-prerelease GitHub Release is
published. The release tag must match the version in `package.json`, for example
`v3.0.0`.

## Versioning

Releases follow [Semantic Versioning](https://semver.org/). Available versions are
listed in the repository's [tags](https://github.com/slpxxv/rabbit-relay-rpc/tags).

## License

Licensed under the [MIT License](LICENSE.md).
