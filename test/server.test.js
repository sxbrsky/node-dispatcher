const assert = require('node:assert/strict')
const { test } = require('node:test')

const createServer = require('../src/server')

test('server invokes a handler and publishes its result', async () => {
  const channel = createChannel()
  const server = await createServer({ createChannel: async () => channel })
  server.register('sum', (left, right) => left + right)
  await server.listen()

  await channel.deliver({ handler: 'sum', args: [2, 3] })

  assert.deepEqual(JSON.parse(channel.sent[0].content), { ok: true, value: 5 })
  assert.equal(channel.acked, 1)
  await server.close()
})

test('server returns a structured error for an unknown handler', async () => {
  const channel = createChannel()
  const server = await createServer({ createChannel: async () => channel })
  await server.listen()

  await channel.deliver({ handler: 'missing', args: [] })

  const response = JSON.parse(channel.sent[0].content)
  assert.equal(response.ok, false)
  assert.match(response.error.message, /Unknown RPC handler/)
  assert.equal(channel.acked, 1)
  await server.close()
})

function createChannel () {
  const channel = {
    acked: 0,
    sent: [],
    ack: () => { channel.acked += 1 },
    assertQueue: async () => {},
    cancel: async () => {},
    close: async () => {},
    consume: async (queue, callback) => {
      channel.onMessage = callback
      return { consumerTag: 'consumer' }
    },
    sendToQueue: (queue, content, options) => channel.sent.push({ content, options, queue }),
    deliver: payload => channel.onMessage({
      content: Buffer.from(JSON.stringify(payload)),
      properties: { correlationId: 'id', replyTo: 'reply.queue' }
    })
  }
  return channel
}
