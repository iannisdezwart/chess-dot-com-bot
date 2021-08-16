import * as http from 'http'
import { exec } from 'child_process'

// Run and set up Stockfish

const stockfish = exec('Stockfish/src/stockfish')
let bestmove = ''
let score = ''

stockfish.stdout.on('data', (chunk: string) => {
	console.log('Stockfish:', chunk)

	if (chunk.includes('pv')) {
		let newBestMove = chunk.substr(chunk.lastIndexOf('pv') + 3)
		newBestMove = newBestMove.substr(0, newBestMove.indexOf('\n'))
		if (!bestmove.startsWith(newBestMove)) bestmove = newBestMove
	}

	if (chunk.includes('score cp')) {
		let str = chunk.substr(chunk.lastIndexOf('score cp') + 9)
		score = (+str.substr(0, str.indexOf(' ')) / 100).toString()
	}

	if (chunk.includes('score mate')) {
		let str = chunk.substr(chunk.lastIndexOf('score mate') + 11)
		score = 'Mate in ' + str.substr(0, str.indexOf(' '))
	}
})

stockfish.stdin.write(`uci\n`)
stockfish.stdin.write(`ucinewgame\n`)

// Parse request body

const parseJSONBody = (
	req: http.IncomingMessage
) => new Promise<any>(resolve => {
	let body = ''

	req.on('data', chunk => body += chunk)
	req.on('end', () => {
		try {
			const bodyObj = JSON.parse(body)
			resolve(bodyObj)
		} catch(err) {
			resolve(null)
		}
	})
})

const search = (body: any, res: http.ServerResponse) => {
	const { board } = body

	if (board == null) {
		res.end('missing body parameters')
		return
	}

	stockfish.stdin.write(`position startpos moves ${ board }\n`)
	stockfish.stdin.write(`go infinite\n`)

	res.end('started searching')
}

const stopSearching = (res: http.ServerResponse) => {
	stockfish.stdin.write(`stop\n`)
	res.end('stopped searching')
}

const getBestMove = (res: http.ServerResponse) => {
	res.end(bestmove)
}

const getScore = (res: http.ServerResponse) => {
	res.end(score)
}

const server = http.createServer(async (req, res) => {
	const body = await parseJSONBody(req)
	console.log(body)

	if (body == null) {
		res.end('missing body')
		return
	}

	const { type } = body

	if (body == null || type == null) {
		res.end('missing body parameters')
		return
	}

	switch (type) {
		case 'search':
			search(body, res)
			break

		case 'stop-searching':
			stopSearching(res)
			break

		case 'get-best-move':
			getBestMove(res)
			break

		case 'get-score':
			getScore(res)
			break
	}
})

const port = +process.argv[2] || 1337

server.listen(port, () => {
	console.log(`server listening on port ${ port }`)
})