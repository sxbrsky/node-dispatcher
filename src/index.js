const amqplib = require('amqplib')

module.exports = async (url, options = {}) => {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new TypeError('RabbitMQ URL must be a non-empty string')
  }

  const amqp = await amqplib.connect(url)

  try {
    const server = await require('./server')(amqp, options)
    const client = await require('./client')(amqp, options)

    return {
      call: client.call,
      close: async () => {
        await Promise.allSettled([client.close(), server.close()])
        await amqp.close()
      },
      register: server.register,
      start: server.listen
    }
  } catch (error) {
    await amqp.close()
    throw error
  }
}
