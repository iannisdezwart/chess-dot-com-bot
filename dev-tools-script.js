// Util

const decodeSquare = c => {
	const chessDotComSquareToIndex = c => {
		if (c >= 'a' && c <= 'z') return c.charCodeAt(0) - 'a'.charCodeAt(0)
		if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 'A'.charCodeAt(0) + 26
		if (c >= '0' && c <= '9') return c.charCodeAt(0) - '0'.charCodeAt(0) + 52
		if (c == '!') return 62
		if (c == '?') return 63
		return -1
	}

	const sqNum = chessDotComSquareToIndex(c)

	const x = sqNum % 8
	const y = Math.floor(sqNum / 8)

	const xStr = String.fromCharCode('a'.charCodeAt(0) + x)
	const yStr = String.fromCharCode('1'.charCodeAt(0) + y)

	return xStr + yStr
}

const encodeSquare = sq => {
	const indexToChessDotComSquare = sq => {
		if (sq >= 0 && sq <= 25) return String.fromCharCode('a'.charCodeAt(0) + sq)
		if (sq >= 26 && sq <= 51) return String.fromCharCode('A'.charCodeAt(0) + sq - 26)
		if (sq >= 52 && sq <= 61) return String.fromCharCode('0'.charCodeAt(0) + sq - 52)
		if (sq == 62) return '!'
		if (sq == 63) return '?'
		return -1
	}

	const xStr = sq.charAt(0)
	const yStr = sq.charAt(1)

	const x = xStr.charCodeAt(0) - 'a'.charCodeAt(0)
	const y = yStr.charCodeAt(0) - '1'.charCodeAt(0)

	return indexToChessDotComSquare(x + 8 * y)
}

const encodeSquareIndex = sq => {
	const xStr = sq.charAt(0)
	const yStr = sq.charAt(1)

	const x = xStr.charCodeAt(0) - 'a'.charCodeAt(0)
	const y = yStr.charCodeAt(0) - '1'.charCodeAt(0)

	return [ x, y ]
}

const encodeMove = mv => {
	const from = mv.substr(0, 2)
	const to = mv.substr(2, 2)

	return encodeSquare(from) + encodeSquare(to)
}

const decodeBoard = movesStr => {
	let out = ''

	for (let i = 0; i < movesStr.length / 2; i++) {
		const from = movesStr.charAt(i * 2)
		const to = movesStr.charAt(i * 2 + 1)
		const fromSq = decodeSquare(from)
		const toSq = decodeSquare(to)
		out += fromSq + toSq + ' '
	}

	return out
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const request = async body => {
	const res = await fetch('http://localhost:1337', {
		method: 'POST',
		body: JSON.stringify(body)
	})

	return res.text()
}

const startSearchingForBestMove = async board => {
	await request({ type: 'search', board })
}

const stopSearchingForBestMove = async () => {
	await request({ type: 'stop-searching' })
}

const getBestMove = async () => {
	return await request({ type: 'get-best-move' })
}

const hideBestMove = () => {
	document.querySelectorAll('.board .from, .board .to').forEach(el => el.remove())
}

const showBestMove = (bestMove, isBlack) => {
	const [ xFrom, yFrom ] = encodeSquareIndex(bestMove.substr(0, 2))
	const [ xTo, yTo ] = encodeSquareIndex(bestMove.substr(2, 2))

	const xFromTr = isBlack ? 700 - xFrom * 100 : xFrom * 100
	const yFromTr = isBlack ? yFrom * 100 : 700 - yFrom * 100

	const xToTr = isBlack ? 700 - xTo * 100 : xTo * 100
	const yToTr = isBlack ? yTo * 100 : 700 - yTo * 100

	hideBestMove()

	document.querySelector('.board').insertAdjacentHTML('beforeend', /* html */ `
	<div class="from" style="
		width: 12.5%;
		height: 12.5%;
		background: red;
		opacity: 0.3;
		position: absolute;
		transform: translate(${ xFromTr }%, ${ yFromTr }%);
	"></div>
	<div class="to" style="
		width: 12.5%;
		height: 12.5%;
		background: orange;
		opacity: 0.3;
		position: absolute;
		transform: translate(${ xToTr }%, ${ yToTr }%);
	"></div>
	`)
}

// const createMoveMessage = mv => {
// 	return JSON.stringify([{
// 		channel: '/service/game',
// 		clientId: getClientID(),
// 		data: {
// 			move: {
// 				clock: getClock(),
// 				clockms: getClock() * 1000,
// 				coh: false,
// 				gid: getGID(),
// 				lastmovemessagesent: false,
// 				mht: getMHT(),
// 				move: encodeMove(mv),
// 				seq: getSeq(),
// 				squared: true,
// 				uid: getUID()
// 			},
// 			tid: 'Move'
// 		},
// 		id: getID()
// 	}])
// }

// On move

const moveMessages = []

websockets[0].addEventListener('message', async e => {
	try {
		data = JSON.parse(e.data)[0].data
		if (data.tid != 'GameState') return
		if (data.game.reason != 'movemade') return

		moveMessages.push(data)

		const numOfMoveMessages = moveMessages.length
		const boardState = decodeBoard(data.game.moves)
		console.log('current board state:', boardState)
		const isBlack = document.querySelector('.board').classList.contains('flipped')

		if (!isBlack && data.game.seq % 2 == 0 || isBlack && data.game.seq % 2 == 1) {
			await startSearchingForBestMove(boardState)
			console.log('started searching for best move')

			// Until move is made, request best move

			while (numOfMoveMessages == moveMessages.length) {
				const bestMove = await getBestMove()
				console.log('best move:', bestMove)

				showBestMove(bestMove, isBlack)
				await sleep(500)
			}

			await stopSearchingForBestMove()
			hideBestMove()
			console.log('stopped searching for best move')
		}
	} catch (err) {}
})