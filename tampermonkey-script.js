// ==UserScript==
// @name         Chess.com interception
// @namespace    https://chess.com/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://www.chess.com/*
// @grant        none
// ==/UserScript==

// Util

(() => {
	const decodeSquare = (c, fromC) => {
		const chessDotComSquareToIndex = c => {
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

		const promotionXOffset = c => {
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

		const promotionPiece = c => {
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
			const toSq = decodeSquare(to, from)
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

	const getScore = async () => {
		return await request({ type: 'get-score' })
	}

	const hideBestMove = () => {
		document.querySelectorAll('.board .from, .board .to, .board .arrow-canvas')
			.forEach(el => el.remove())
	}

	let show = Boolean(+localStorage.getItem('show-moves')) || false

	addEventListener('keyup', e => {
		if (e.key == 's') {
			if (show) {
				show = false
				document.querySelector('#chess-bot-stats-show-moves').innerHTML = 'Off'
				localStorage.setItem('show-moves', '0')
				hideBestMove()
			} else {
				show = true
				document.querySelector('#chess-bot-stats-show-moves').innerHTML = 'On'
				localStorage.setItem('show-moves', '1')
			}
		}
	})

	const showBestMove = (bestMove, isBlack) => {
		hideBestMove()

		const fillRectangles = (xFrom, yFrom, xTo, yTo) => {
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
		" height="1000" width="1000"></canvas>
		`)

		const canvas = document.querySelector('.arrow-canvas')
		const ctx = canvas.getContext('2d')

		const drawArrow = (xFrom, yFrom, xTo, yTo, index) => {
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

		for (let i = 0; i < 3 && i < moves.length; i++) {
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

	document.body.insertAdjacentHTML('beforeend', /* html */ `
	<div id="chess-bot-stats" style="
		position: absolute;
		background-color: rgba(255, 0, 0, 0.5);
		top: 0;
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
			<span id="chess-bot-stats-show-moves">
				${ localStorage.getItem('show-moves') == '0' ? 'Off' : 'On' }
			</span>
		</div>
	</div>
	`)

	setInterval(async () => {
		document.querySelector('#chess-bot-stats-score').innerHTML = await getScore()
	}, 500)

	// On move

	window.websockets = []
	window.moveMessages = []

	const onNewWebsocket = ws => {
		if (ws.url == 'wss://live2.chess.com/cometd') {
			console.log('Hooked to game websocket')

			ws.addEventListener('message', async e => {
				try {
					const data = JSON.parse(e.data)[0].data

					if (data.tid == 'EndGame') {
						moveMessages.push(data)
						return
					}

					if (data.tid != 'GameState') return
					if (data.game.reason != 'movemade') return

					window.moveMessages.push(data)

					const numOfMoveMessages = window.moveMessages.length
					const boardState = decodeBoard(data.game.moves)
					console.log('current board state:', boardState)
					const isBlack = document.querySelector('.board').classList.contains('flipped')

					if (!isBlack && data.game.seq % 2 == 0 || isBlack && data.game.seq % 2 == 1) {
						await startSearchingForBestMove(boardState)
						console.log('started searching for best move')

						// Until move is made, request best move

						while (numOfMoveMessages == window.moveMessages.length) {
							window.bestMove = await getBestMove()
							console.log('best move:', bestMove)

							if (show) {
								showBestMove(bestMove, isBlack)
							}

							await sleep(500)
						}

						await stopSearchingForBestMove()
						hideBestMove()
						console.log('stopped searching for best move')
					}
				} catch (err) {}
			})
		}
	}

	const OrigWebSocket = WebSocket
	const callWebSocket = OrigWebSocket.apply.bind(OrigWebSocket)
	let wsAddListener = OrigWebSocket.prototype.addEventListener

	wsAddListener = wsAddListener.call.bind(wsAddListener)

	window.WebSocket = function WebSocket(url, protocols) {
		let ws

		if (!(this instanceof WebSocket)) {
			// Called without 'new' (browsers will throw an error).
			ws = callWebSocket(this, arguments)
		} else if (arguments.length == 1) {
			ws = new OrigWebSocket(url)
		} else if (arguments.length >= 2) {
			ws = new OrigWebSocket(url, protocols)
		} else { // No arguments (browsers will throw an error)
			ws = new OrigWebSocket()
		}

		wsAddListener(ws, 'message', function(event) {
			// console.log('websocket recv:', event.data)
		})

		window.websockets.push(ws)

		if (onNewWebsocket != null) {
			onNewWebsocket(ws)
		}

		return ws
	}.bind()

	WebSocket.prototype = OrigWebSocket.prototype
	WebSocket.prototype.constructor = WebSocket
	WebSocket.CONNECTING = 0
	WebSocket.OPEN = 1
	WebSocket.CLOSING = 2
	WebSocket.CLOSED = 3

	let wsSend = OrigWebSocket.prototype.send
	wsSend = wsSend.apply.bind(wsSend)

	OrigWebSocket.prototype.send = function(data) {
		// console.log('websocket send:', data)
		return wsSend(this, arguments)
	}
})()