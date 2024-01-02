import { Context } from '@tenderly/actions'

const axios = require('axios')

export const sendMessagesToSlack = async (messages: Array<string>, context: Context, webhookSecretName: string) => {
	const slackWebhookUrl = await context.secrets.get(webhookSecretName)

	const slackResponses = await Promise.all(messages.map(async (message) => {
		await axios.post(slackWebhookUrl, { text: message })
	}))

	for (const slackResponse of slackResponses) {
		console.log(slackResponse)
	}
}
