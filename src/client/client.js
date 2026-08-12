const { randomUUID } = require('node:crypto')

const DEFAULT_TIMEOUT_MS = 60_000

module.exports = async (connection, options = {}) => {
  const commandQueue = options.commandQueue ?? 'commands'
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pendingRequests = new Map()
  const channel = await connection.createChannel()
  const { queue: replyQueue } = await channel.assertQueue('', {
    autoDelete: true,
    exclusive: true
  })

  await channel.consume(replyQueue, message => {
    if (!message) return

    const { correlationId } = message.properties
    const request = pendingRequests.get(correlationId)
    if (!request) return

    clearTimeout(request.timer)
    pendingRequests.delete(correlationId)

    try {
      const response = JSON.parse(message.content.toString())
      if (response.ok) {
        request.resolve(response.value)
      } else {
        request.reject(createRemoteError(response.error))
      }
    } catch (error) {
      request.reject(new Error('Invalid RPC response', { cause: error }))
    }
  }, { noAck: true })

  const call = (handler, ...args) => {
    validateHandlerName(handler)

    return new Promise((resolve, reject) => {
      const correlationId = randomUUID()
      const timer = setTimeout(() => {
        pendingRequests.delete(correlationId)
        reject(new Error(`RPC call "${handler}" timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      pendingRequests.set(correlationId, { resolve, reject, timer })

      try {
        channel.sendToQueue(
          commandQueue,
          Buffer.from(JSON.stringify({ handler, args })),
          {
            contentType: 'application/json',
            correlationId,
            replyTo: replyQueue
          }
        )
      } catch (error) {
        clearTimeout(timer)
        pendingRequests.delete(correlationId)
        reject(error)
      }
    })
  }

  const close = async () => {
    for (const request of pendingRequests.values()) {
      clearTimeout(request.timer)
      request.reject(new Error('RPC client closed before receiving a response'))
    }
    pendingRequests.clear()
    await channel.close()
  }

  return { call, close }
}

function validateHandlerName (handler) {
  if (typeof handler !== 'string' || handler.trim() === '') {
    throw new TypeError('Handler name must be a non-empty string')
  }
}

function createRemoteError (details = {}) {
  const error = new Error(details.message ?? 'Remote handler failed')
  error.name = details.name ?? 'RemoteError'
  return error
}
