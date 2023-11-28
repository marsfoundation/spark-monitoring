import * as dotenv from "dotenv";

const axios = require('axios');

const DataProviderAbi = require('../jsons/data-provider.json');

const ethers = require('ethers');

dotenv.config();

const main = async() => {
	const token = process.env.TENDERLY_ACCESS_KEY!;
	const pagerDuty = process.env.PAGERDUTY_ACCESS_KEY!;

	const DATA_PROVIDER_ADDRESS = "0xFc21d6d146E6086B8359705C8b28512a983db0cb";

	// // Log out all keys in ethers
	// console.log(Object.keys(ethers));

	const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL!);

	const dataProvider = new ethers.Contract(DATA_PROVIDER_ADDRESS, DataProviderAbi, provider);

	const rawOutput: bigint[] = await dataProvider.getReserveData("0x6b175474e89094c44da98b954eedeac495271d0f");

	// Define labels for each value
	const labels = [
		"Value 1",
		"Value 2",
		"Value 3",
		"Value 4",
		"Value 5",
		"Value 6",
		"Value 7",
		"Value 8",
		"Value 9",
		"Value 10",
		"Value 11",
		"Value 12"
	];

	// console.dir(Object.keys(ethers), {depth: null});

  	// Combine labels and values into an array of objects
  	const formattedData = rawOutput.map((value, index) => ({
		label: labels[index],
		value: BigInt(value).toString(),
  	}));

  	// console.log(formattedData);

	const url = 'https://events.pagerduty.com/v2/enqueue';
	const headers = {
	  'Content-Type': 'application/json',
	};
	const data = {
	  payload: {
		summary: formattedData[0].value,
		severity: 'critical',
		source: 'Alert source',
	  },
	  routing_key: pagerDuty,
	  event_action: 'trigger',
	};

	// const pagerDutyResponse = await axios.post(url, data, { headers });

	// console.log(pagerDutyResponse.data);

	const slackResponse = await axios.post(process.env.SLACK_WEBHOOK_URL!, { text: `value: ${formattedData[0].value}` });

	console.log(slackResponse.data);
}

main();
