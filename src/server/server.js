module.exports = async (connection, options = {}) => {
  const commandQueue = options.commandQueue ?? 'commands'
  const handlers = new Map()
  const channel = await connection.createChannel()
  let consumerTag

  const listen = async () => {
    if (consumerTag) return

    await channel.assertQueue(commandQueue, { durable: false })
    if (options.prefetch) await channel.prefetch(options.prefetch)

    const consumer = await channel.consume(commandQueue, async message => {
      if (!message) return

      const { correlationId, replyTo } = message.properties
      try {
        const request = parseRequest(message)
        const handler = handlers.get(request.handler)
        if (!handler) throw new Error(`Unknown RPC handler: ${request.handler}`)

        const value = await handler(...request.args)
        sendResponse(replyTo, correlationId, { ok: true, value })
      } catch (error) {
        sendResponse(replyTo, correlationId, {
          ok: false,
          error: {
            message: error.message,
            name: error.name
          }
        })
      } finally {
        channel.ack(message)
      }
    })
    consumerTag = consumer.consumerTag
  }

  const register = (handler, callback) => {
    if (typeof handler !== 'string' || handler.trim() === '') {
      throw new TypeError('Handler name must be a non-empty string')
    }
    if (typeof callback !== 'function') {
      throw new TypeError('Handler callback must be a function')
    }
    handlers.set(handler, callback)
  }

  const close = async () => {
    if (consumerTag) await channel.cancel(consumerTag)
    await channel.close()
  }

  const sendResponse = (replyTo, correlationId, response) => {
    if (!replyTo) return
    channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), {
      contentType: 'application/json',
      correlationId
    })
  }

  return { close, listen, register }
}

function parseRequest (message) {
  const request = JSON.parse(message.content.toString())
  if (!request || typeof request.handler !== 'string') {
    throw new TypeError('Invalid RPC request')
  }
  return {
    args: Array.isArray(request.args) ? request.args : [],
    handler: request.handler
  }
}
