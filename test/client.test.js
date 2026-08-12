const assert = require('node:assert/strict')
const { test } = require('node:test')

const createClient = require('../src/client')

test('client resolves a successful JSON response', async () => {
  const channel = createChannel()
  const client = await createClient(createConnection(channel), { timeoutMs: 100 })
  const resultPromise = client.call('sum', 2, 3)
  const request = channel.sent[0]

  channel.deliver({ ok: true, value: 5 }, request.options.correlationId)

  assert.equal(await resultPromise, 5)
  await client.close()
})

test('client turns a remote failure into an Error', async () => {
  const channel = createChannel()
  const client = await createClient(createConnection(channel), { timeoutMs: 100 })
  const resultPromise = client.call('fail')
  const request = channel.sent[0]

  channel.deliver({ ok: false, error: { name: 'TypeError', message: 'bad input' } }, request.options.correlationId)

  await assert.rejects(resultPromise, { name: 'TypeError', message: 'bad input' })
  await client.close()
})

function createConnection (channel) {
  return { createChannel: async () => channel }
}

function createChannel () {
  const channel = {
    sent: [],
    assertQueue: async () => ({ queue: 'reply.queue' }),
    close: async () => {},
    consume: async (queue, callback) => { channel.onMessage = callback },
    sendToQueue: (queue, content, options) => channel.sent.push({ content, options, queue }),
    deliver: (payload, correlationId) => channel.onMessage({
      content: Buffer.from(JSON.stringify(payload)),
      properties: { correlationId }
    })
  }
  return channel
}
