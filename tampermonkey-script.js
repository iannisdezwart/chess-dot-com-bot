// ==UserScript==
// @name         Chess.com interception
// @namespace    https://chess.com/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://www.chess.com/*
// @grant        none
// ==/UserScript==

(() => {
	window.websockets = []
	window.onNewWebsocket = null

	const OrigWebSocket = window.WebSocket
	const callWebSocket = OrigWebSocket.apply.bind(OrigWebSocket)
	const wsAddListener = OrigWebSocket.prototype.addEventListener

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

		if (window.onNewWebsocket != null) {
			window.onNewWebsocket(ws)
		}

		return ws
	}.bind()

	window.WebSocket.prototype = OrigWebSocket.prototype
	window.WebSocket.prototype.constructor = window.WebSocket
	window.WebSocket.CONNECTING = 0
	window.WebSocket.OPEN = 1
	window.WebSocket.CLOSING = 2
	window.WebSocket.CLOSED = 3

	let wsSend = OrigWebSocket.prototype.send
	wsSend = wsSend.apply.bind(wsSend)

	OrigWebSocket.prototype.send = function(data) {
		// console.log('websocket send:', data)
		return wsSend(this, arguments)
	}
})()