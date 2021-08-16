// ==UserScript==
// @name         Chess.com interception
// @namespace    https://chess.com/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://www.chess.com/*
// @grant        none
// ==/UserScript==

interface Window {
	websockets: WebSocket[]
	moveMessages: any[]
	sentMessages: any[]
	lastMessageId: number
	clock: number
	lastMoveOpponentPlayedTime: number
	seq: number
	clientId: string
	uid: string
}

window.websockets = []
window.moveMessages = []
window.sentMessages = []
window.seq = 1

interface Player {
	gid: number
	id: number
	lag: number
	lagms: number
	status: string
	uid: string
	userclass: string
	uuid: string
}

interface Game {
	clocks: [ number, number ]
	draws: []
	id: number
	moves: string
	players: [ Player, Player ]
	reason: string
	seq: number
	squares: [ number, number ]
	status: string
}

interface MoveMade {
	game: Game
	sid: string
	tid: string
}

interface MoveUpload {
	move: Move
	tid: 'Move'
}

interface Move {
	clock: number
	clockms: number
	coh: boolean
	gid: number
	lastmovemessagesent: boolean
	mht: number
	move: string
	seq: number
	squared: boolean
	uid: string
}

interface IncomingWSMessage {
	channel: string
	id?: string
	data?: any
	ext?: any
	successful?: boolean
}

interface OutgoingWSMessage {
	channel: string
	clientId: string
	id: string
	data?: any
	ext?: any
	connectionType?: string
}

const GAME_WEBSOCKET_URL = 'wss://live2.chess.com/cometd'

// Util

const decodeSquare = (c: string, fromC?: string) => {
	const chessDotComSquareToIndex = (c: string) => {
		if (c >= 'a' && c <= 'z') return c.charCodeAt(0) - 'a'.charCodeAt(0)
		if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 'A'.charCodeAt(0) + 26
		if (c >= '0' && c <= '9') return c.charCodeAt(0) - '0'.charCodeAt(0) + 52
		if (c == '!') return 62
		if (c == '?') return 63

		if (c == '{') return 64 // Left queen promotion
		if (c == '~') return 65 // Forward queen promotion
		if (c == '}') return 66 // Right queen promotion

		if (c == '(') return 67 // Left knight promotion
		if (c == '^') return 68 // Forward knight promotion
		if (c == ')') return 69 // Right knight promotion

		if (c == '[') return 70 // Left rook promotion
		if (c == '_') return 71 // Forward rook promotion
		if (c == ']') return 72 // Right rook promotion

		if (c == '@') return 70 // Left bishop promotion
		if (c == '#') return 71 // Forward bishop promotion
		if (c == '$') return 72 // Right bishop promotion
		return -1
	}

	const promotionXOffset = (c: string) => {
		if (c == '{') return -1 // Left queen promotion
		if (c == '~') return 0 // Forward queen promotion
		if (c == '}') return 1 // Right queen promotion

		if (c == '(') return -1 // Left knight promotion
		if (c == '^') return 0 // Forward knight promotion
		if (c == ')') return 1 // Right knight promotion

		if (c == '[') return -1 // Left rook promotion
		if (c == '_') return 0 // Forward rook promotion
		if (c == ']') return 1 // Right rook promotion

		if (c == '@') return -1 // Left bishop promotion
		if (c == '#') return 0 // Forward bishop promotion
		if (c == '$') return 1 // Right bishop promotion

		return 0
	}

	const promotionPiece = (c: string) => {
		if (c == '{') return 'q' // Left queen promotion
		if (c == '~') return 'q' // Forward queen promotion
		if (c == '}') return 'q' // Right queen promotion

		if (c == '(') return 'n' // Left knight promotion
		if (c == '^') return 'n' // Forward knight promotion
		if (c == ')') return 'n' // Right knight promotion

		if (c == '[') return 'r' // Left rook promotion
		if (c == '_') return 'r' // Forward rook promotion
		if (c == ']') return 'r' // Right rook promotion

		if (c == '@') return 'b' // Left bishop promotion
		if (c == '#') return 'b' // Forward bishop promotion
		if (c == '$') return 'b' // Right bishop promotion
	}

	const sqNum = chessDotComSquareToIndex(c)

	if (sqNum < 64) {
		const x = sqNum % 8
		const y = Math.floor(sqNum / 8)

		const xStr = String.fromCharCode('a'.charCodeAt(0) + x)
		const yStr = String.fromCharCode('1'.charCodeAt(0) + y)

		return xStr + yStr
	} else {
		const fromSqNum = chessDotComSquareToIndex(fromC)

		const fromX = fromSqNum % 8
		const fromY = Math.floor(fromSqNum / 8)

		const isWhite = fromY == 6

		const toX = fromX + promotionXOffset(c)
		const toY = isWhite ? 7 : 0

		const piece = promotionPiece(c)

		const toXStr = String.fromCharCode('a'.charCodeAt(0) + toX)
		const toYStr = String.fromCharCode('1'.charCodeAt(0) + toY)

		return toXStr + toYStr + piece
	}
}

const encodeSquareIndex = (sq: string) => {
	const xStr = sq.charAt(0)
	const yStr = sq.charAt(1)

	const x = xStr.charCodeAt(0) - 'a'.charCodeAt(0)
	const y = yStr.charCodeAt(0) - '1'.charCodeAt(0)

	return [ x, y ]
}

const encodeSquare = (sq: string) => {
	const indexToChessDotComSquare = (sq: number) => {
		if (sq >= 0 && sq <= 25) return String.fromCharCode('a'.charCodeAt(0) + sq)
		if (sq >= 26 && sq <= 51) return String.fromCharCode('A'.charCodeAt(0) + sq - 26)
		if (sq >= 52 && sq <= 61) return String.fromCharCode('0'.charCodeAt(0) + sq - 52)
		if (sq == 62) return '!'
		if (sq == 63) return '?'
		return ''
	}

	const xStr = sq.charAt(0)
	const yStr = sq.charAt(1)

	const x = xStr.charCodeAt(0) - 'a'.charCodeAt(0)
	const y = yStr.charCodeAt(0) - '1'.charCodeAt(0)

	return indexToChessDotComSquare(x + 8 * y)
}

const encodeMove = (mv: string) => {
	const from = mv.substr(0, 2)
	const to = mv.substr(2, 2)
	const promotion = mv.substr(4, 1)

	if (promotion == '') {
		return encodeSquare(from) + encodeSquare(to)
	} else {
		const [ fromX ] = encodeSquareIndex(from)
		const [ toX ] = encodeSquareIndex(to)

		let promotionChar: string

		switch (promotion) {
			case 'q':
				if (toX < fromX)  promotionChar = '{' // Left queen promotion
				if (toX == fromX) promotionChar = '~' // Forward queen promotion
				else              promotionChar = '}' // Right queen promotion

			case 'k':
				if (toX < fromX)  promotionChar = '(' // Left knight promotion
				if (toX == fromX) promotionChar = '^' // Forward knight promotion
				else              promotionChar = ')' // Right knight promotion

			case 'r':
				if (toX < fromX)  promotionChar = '[' // Left rook promotion
				if (toX == fromX) promotionChar = '_' // Forward rook promotion
				else              promotionChar = ']' // Right rook promotion

			case 'b':
				if (toX < fromX)  promotionChar = '@' // Left bishop promotion
				if (toX == fromX) promotionChar = '#' // Forward bishop promotion
				else              promotionChar = '$' // Right bishop promotion
		}

		return encodeSquare(from) + promotionChar
	}
}

const decodeBoard = (movesStr: string) => {
	let out = ''

	for (let i = 0; i < movesStr.length / 2; i++) {
		const from = movesStr.charAt(i * 2)
		const to = movesStr.charAt(i * 2 + 1)
		const fromSq = decodeSquare(from)
		const toSq = decodeSquare(to, from)
		out += fromSq + toSq + ' '
	}

	return out
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const request = async (body: any) => {
	const res = await fetch('http://localhost:1337', {
		method: 'POST',
		body: JSON.stringify(body)
	})

	return res.text()
}

const startSearchingForBestMove = async (board: string) => {
	await request({ type: 'search', board })
}

const stopSearchingForBestMove = async () => {
	await request({ type: 'stop-searching' })
}

const getBestMove = async () => {
	return await request({ type: 'get-best-move' })
}

const getScore = async () => {
	return await request({ type: 'get-score' })
}

const hideBestMove = () => {
	document.querySelectorAll('.board .from, .board .to, .board .arrow-canvas')
		.forEach(el => el.remove())
}

// Options

document.body.insertAdjacentHTML('beforeend', /* html */ `
<div id="chess-bot-stats" style="
	position: fixed;
	background-color: rgba(255, 0, 0, 0.5);
	bottom: 0;
	right: 0;
	color: #fff;
	padding: .5em;
">
	<div>
		Score:
		<span id="chess-bot-stats-score">0</span>
	</div>
	<div>
		Show moves:
		<input type="checkbox" id="show-moves"
			${ localStorage.getItem('show-moves') == '1' ? 'checked' : '' }>
	</div>
	<div>
		Auto move:
		<input type="checkbox" id="auto-move"
			${ localStorage.getItem('auto-move') == '1' ? 'checked' : '' }>
	</div>
	<div>
		Clock:
		<span id="chess-bot-stats-clock"></span>
	</div>
</div>
`)

let show = () => Boolean(+localStorage.getItem('show-moves')) || false
let autoMove = () => Boolean(+localStorage.getItem('auto-move')) || false

const showMovesCheckbox = document.querySelector<HTMLInputElement>('#show-moves')
const autoMoveCheckbox = document.querySelector<HTMLInputElement>('#auto-move')

const createToggleHandler = (
	checkbox: HTMLInputElement,
	localStorageName: string,
	cb?: (checked: boolean) => void
) => () => {
	localStorage.setItem(localStorageName, checkbox.checked ? '1' : '0')
	if (cb != null) cb(checkbox.checked)
}

showMovesCheckbox.addEventListener('change',
	createToggleHandler(showMovesCheckbox, 'show-moves',
		checked => !checked ? hideBestMove() : null))

autoMoveCheckbox.addEventListener('change',
	createToggleHandler(autoMoveCheckbox, 'auto-move'))

const showBestMove = (bestMove: string, isBlack: boolean) => {
	hideBestMove()

	const fillRectangles = (xFrom: number, yFrom: number, xTo: number, yTo: number) => {
		document.querySelector('.board').insertAdjacentHTML('beforeend', /* html */ `
		<div class="from" style="
			width: 12.5%;
			height: 12.5%;
			background: red;
			opacity: 0.3;
			position: absolute;
			transform: translate(${ xFrom }%, ${ yFrom }%);
		"></div>

		<div class="to" style="
			width: 12.5%;
			height: 12.5%;
			background: orange;
			opacity: 0.3;
			position: absolute;
			transform: translate(${ xTo }%, ${ yTo }%);
		"></div>
		`)
	}

	document.querySelector('.board').insertAdjacentHTML('beforeend', /* html */ `
	<canvas class="arrow-canvas" style="
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		z-index: 999;
		pointer-events: none;
	" height="1000" width="1000"></canvas>
	`)

	const canvas = document.querySelector<HTMLCanvasElement>('.arrow-canvas')
	const ctx = canvas.getContext('2d')

	const drawArrow = (
		xFrom: number, yFrom: number,
		xTo: number, yTo: number,
		index: number
	) => {
		const dy = yTo - yFrom
		const dx = xTo - xFrom
		const angle = Math.atan2(dy, dx)
		const length = Math.hypot(dy, dx)

		const xToShort = xFrom + (length - 35) * Math.cos(angle)
		const yToShort = yFrom + (length - 35) * Math.sin(angle)
		const opacity = 1 / (index + 1)

		ctx.lineWidth = 15
		ctx.strokeStyle = `hsla(${ index * 30 }, 100%, 50%, ${ opacity })`
		ctx.fillStyle = `hsla(${ index * 30 }, 100%, 50%, ${ opacity })`

		ctx.beginPath()
		ctx.moveTo(xFrom, yFrom)
		ctx.lineTo(xToShort, yToShort)
		ctx.closePath()
		ctx.stroke()

		ctx.beginPath()
		ctx.moveTo(xTo, yTo)
		ctx.lineTo(xTo - 40 * Math.cos(angle - Math.PI / 6),
			yTo - 40 * Math.sin(angle - Math.PI / 6))
		ctx.lineTo(xTo - 40 * Math.cos(angle + Math.PI / 6),
			yTo - 40 * Math.sin(angle + Math.PI / 6))
		ctx.lineTo(xTo, yTo)
		ctx.closePath()
		ctx.fill()
	}

	const moves = bestMove.split(' ')

	for (let i = 0; i < 10 && i < moves.length; i++) {
		const [ xFrom, yFrom ] = encodeSquareIndex(moves[i].substr(0, 2))
		const [ xTo, yTo ] = encodeSquareIndex(moves[i].substr(2, 2))

		if (i == 0) {
			const xFromCSS = isBlack ? 700 - xFrom * 100 : xFrom * 100
			const yFromCSS = isBlack ? yFrom * 100 : 700 - yFrom * 100

			const xToCSS = isBlack ? 700 - xTo * 100 : xTo * 100
			const yToCSS = isBlack ? yTo * 100 : 700 - yTo * 100

			fillRectangles(xFromCSS, yFromCSS, xToCSS, yToCSS)
		}

		const xFromCanvas = isBlack ? 937 - xFrom * 125 : 63 + xFrom * 125
		const yFromCanvas = isBlack ? 63 + yFrom * 125 : 937 - yFrom * 125

		const xToCanvas = isBlack ? 937 - xTo * 125 : 63 + xTo * 125
		const yToCanvas = isBlack ? 63 + yTo * 125 : 937 - yTo * 125

		drawArrow(xFromCanvas, yFromCanvas, xToCanvas, yToCanvas, i)
	}
}

// Score timeout

// Update score

setInterval(async () => {
	document.querySelector('#chess-bot-stats-score').innerHTML = await getScore()
}, 500)

// Get Game Id

const getGameId = () => {
	return +location.href.substring(location.href.lastIndexOf('/') + 1)
}

// Get Game WebSocket

const getGameWebSocket = () => {
	for (const ws of window.websockets) {
		if (ws.url == GAME_WEBSOCKET_URL) return ws
	}
}

// Perform a move

const performMove = (move: string) => {
	const timeTaken = Date.now() - window.lastMoveOpponentPlayedTime
	const newClockMs = window.clock * 100 - timeTaken
	const ws = getGameWebSocket()

	const moveData: Move = {
		clock: Math.floor(newClockMs / 100),
		clockms: newClockMs,
		coh: false,
		gid: getGameId(),
		lastmovemessagesent: false,
		mht: Math.floor(Math.random() * 1000),
		move: encodeMove(move),
		seq: window.seq,
		squared: true,
		uid: window.uid
	}

	const outgoingMessage: OutgoingWSMessage = {
		channel: '/service/game',
		id: (window.lastMessageId + 1).toString(),
		data: {
			move: moveData,
			tid: 'Move'
		},
		clientId: window.clientId
	}

	window.lastMessageId++

	console.log('sent', outgoingMessage)

	ws.send(JSON.stringify([ outgoingMessage ]))
}

// On move

const handleMoveMade = async (data: MoveMade) => {
	window.moveMessages.push(data)

	const numOfMoveMessages = window.moveMessages.length
	const boardState = decodeBoard(data.game.moves)

	console.log('current board state:', boardState)

	const isBlack = document.querySelector('.board').classList.contains('flipped')
	const isTurn = data.game.seq % 2 == (isBlack ? 1 : 0)

	window.seq = data.game.seq

	window.clock = isBlack ? data.game.clocks[1] : data.game.clocks[0]
	document.querySelector('#chess-bot-stats-clock').innerHTML = window.clock.toString()

	if (isTurn) {
		window.lastMoveOpponentPlayedTime = Date.now()
	}

	await stopSearchingForBestMove()
	hideBestMove()
	console.log('stopped searching for best move')

	await startSearchingForBestMove(boardState)
	console.log('started searching for best move')

	// Until move is made, request best move

	const startTime = Date.now()

	while (numOfMoveMessages == window.moveMessages.length) {
		const bestMove = await getBestMove()
		console.log('best move:', bestMove)

		if (show()) {
			showBestMove(bestMove, isBlack)
		}

		if (isTurn && autoMove() && Date.now() - startTime > 1000) {
			await sleep(Math.random() * 500)
			performMove(bestMove.split(' ')[0])
		}

		await sleep(500)
	}
}

const onNewWebsocket = (ws: WebSocket) => {
	if (ws.url != GAME_WEBSOCKET_URL) return

	console.log('Hooked to game websocket')

	ws.addEventListener('message', async e => {
		const wsMessage: IncomingWSMessage = JSON.parse(e.data)[0]

		try {
			if (wsMessage?.id) {
				window.lastMessageId = +wsMessage.id
			}

			if (wsMessage?.data?.user?.uid) {
				window.uid = wsMessage.data.user.uid
			}

			const { data } = wsMessage

			if (data.tid == 'EndGame') {
				window.moveMessages.push(data)
				return
			}

			if (data.tid == 'GameState' && data.game.reason == 'movemade' || data.tid == 'FullGame') {
				handleMoveMade(data)
			}
		} catch (err) {}
	})
}

const OrigWebSocket = WebSocket
const callWebSocket = OrigWebSocket.apply.bind(OrigWebSocket)
let wsAddListener = OrigWebSocket.prototype.addEventListener

wsAddListener = wsAddListener.call.bind(wsAddListener)

window.WebSocket = function WebSocket(url: string, protocols: string | string[]) {
	let ws: WebSocket

	if (!(this instanceof WebSocket)) {
		// Called without 'new' (browsers will throw an error).
		ws = callWebSocket(this, arguments)
	} else if (arguments.length == 1) {
		ws = new OrigWebSocket(url)
	} else if (arguments.length >= 2) {
		ws = new OrigWebSocket(url, protocols)
	} else { // No arguments (browsers will throw an error)
		throw new TypeError('Failed to construct \'WebSocket\': 1 argument required, but only 0 present.')
	}

	// wsAddListener(ws, 'message', function(event) {
	// 	console.log('websocket recv:', event.data)
	// })

	window.websockets.push(ws)

	if (onNewWebsocket != null) {
		onNewWebsocket(ws)
	}

	return ws
}.bind(null)

WebSocket.prototype = OrigWebSocket.prototype
WebSocket.prototype.constructor = WebSocket
// @ts-ignore
WebSocket.CONNECTING = 0
// @ts-ignore
WebSocket.OPEN = 1
// @ts-ignore
WebSocket.CLOSING = 2
// @ts-ignore
WebSocket.CLOSED = 3

let wsSend = OrigWebSocket.prototype.send
wsSend = wsSend.apply.bind(wsSend)

OrigWebSocket.prototype.send = function (data) {
	if (this.url == GAME_WEBSOCKET_URL) {
		const wsMessage: OutgoingWSMessage = JSON.parse(data.toString())[0]

		if (wsMessage?.id) {
			window.lastMessageId = +wsMessage.id
		}

		if (wsMessage?.clientId) {
			window.clientId = wsMessage.clientId
		}

		if (wsMessage?.data?.tid) {
			window.sentMessages.push(wsMessage)
		}
	}

	// @ts-ignore
	return wsSend(this, arguments)
}