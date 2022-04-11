import fs from 'fs';
import { Pool } from 'multiprocessing';

const CORES        = 8;
const MAGIC_NUMBER = 8;
const WORKER_COUNT = CORES * MAGIC_NUMBER;
const WORKERS      = new Pool(WORKER_COUNT);

async function main() {
	console.time();

	const FILE_NAME = 'metadata.json';
	const BASE_URI = "https://divineanarchy.mypinata.cloud/ipfs/Qmaq9VcnrGQiBmGww1aWd6jLYbsgnczJQZdavyEku75LAE";
	const START_ID = 1;
	const END_ID   = 5050;

	if(!BASE_URI) {
		console.log('Please pass an base uri when running this script after execution');
		process.exit(1);
	}

	let urls = [];
	for(let i = START_ID; i <= END_ID; i++) {
		urls.push(`${BASE_URI}/${i}`);
	}

	let worker_promises = [];
	let worker_results  = [];
	const chunk_amount    = Math.ceil(urls.length / WORKER_COUNT);
	let   chunk_count     = 0;
	for(let thread = 1; thread <= WORKER_COUNT; thread++) {
		const chunk_urls = urls.slice(chunk_count, chunk_count + chunk_amount);
		chunk_count += chunk_amount;

		const promise = WORKERS.apply(chunk_urls, getMetadata, { onResult: result => worker_results = worker_results.concat(result) });
		worker_promises.push(promise);
	}
	await Promise.all(worker_promises);

	if(fs.existsSync(FILE_NAME)) {
		fs.rmSync(FILE_NAME);
	}

	console.log('Writing to file...');
	fs.writeFileSync(FILE_NAME, JSON.stringify(worker_results, null, 2));
	console.timeEnd();
}

async function getMetadata(chunk_urls) {
	const axios = require('axios');

	if(chunk_urls.length == 0) {
		return;
	}

	console.log(`${process.pid} - Starting thread for: ${chunk_urls.length} requests`);
	const updater_index = Math.floor(chunk_urls.length - 1 / 20);

	let metadata = [];
	for(const index in chunk_urls) {
		try {
			const url      = chunk_urls[index];
			const { data } = await axios.get(url);

			if(index % updater_index == 0) {
				console.log(`${process.pid} - On index: ${index} / ${chunk_urls.length - 1}`);
			}

			metadata.push(data);
		} catch(err) {
			console.log(err.message);
		}
	}

	return metadata;
}

main().then(() => {
	process.exit();
}).catch(err => {
	console.log(err)
	process.exit();
});