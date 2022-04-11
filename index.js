import fs from 'fs';
import { Pool } from 'multiprocessing';

const WORKER_COUNT = 64;
const WORKERS      = new Pool(WORKER_COUNT);
const DIR_NAME     = 'metadata';
const DIR_FILE_EXT = '';
const FILE_NAME    = 'metadata_summary.json';
const BASE_URI     = "https://divineanarchy.mypinata.cloud/ipfs/Qmaq9VcnrGQiBmGww1aWd6jLYbsgnczJQZdavyEku75LAE";
const START_ID     = 1;
const END_ID       = 5050;

async function main() {
	console.time();

	if(!BASE_URI) {
		console.log('Please pass an base uri when running this script after execution');
		process.exit(1);
	}

	let urls = [];
	for(let i = START_ID; i <= END_ID; i++) {
		urls.push(`${BASE_URI}/${i}`);
	}

	// Create DIR to hold all metadata files
	if(fs.existsSync(DIR_NAME)) {
		fs.rmdirSync(DIR_NAME, { recursive: true });
	}
	fs.mkdirSync(DIR_NAME);

	let worker_promises = [];
	let worker_results  = [];
	const chunk_amount    = Math.ceil(urls.length / WORKER_COUNT);
	let   chunk_count     = 0;
	for(let thread = 1; thread <= WORKER_COUNT; thread++) {
		const chunk_urls = urls.slice(chunk_count, chunk_count + chunk_amount);
		chunk_count += chunk_amount;

		const promise = WORKERS.apply([chunk_urls, DIR_NAME, DIR_FILE_EXT], getMetadata, {
			onResult: result => {
				if(result instanceof Array) {
					worker_results = worker_results.concat(result);
				}
			}
		});
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

async function getMetadata(args) {
	const axios    = require('axios');
	const child_fs = require('fs');

	const [ chunk_urls, dir, ext ] = args;
	console.log(`${process.pid} - Starting thread for: ${chunk_urls.length} requests`);

	let metadata = [];
	for(const index in chunk_urls) {
		const loadMetadata = async () => {
			const url      = chunk_urls[index];
			const id       = url.split('/').pop();
			const { data } = await axios.get(url, { timeout: 15000 });

			child_fs.writeFileSync(`${dir}/${id}${ext}`, JSON.stringify(data, null, 2));
			metadata.push(data);
		}

		try {
			await loadMetadata();
		} catch(err) {
			console.log('Shit broke, but we will try again just incase');

			try {
				await loadMetadata();
			} catch(err) {
				console.log(err.message);
			}
		}
	}

	console.log(`Finished with pid: ${process.pid}`);
	return metadata;
}

main().then(() => {
	process.exit();
}).catch(err => {
	console.log(err)
	process.exit();
});