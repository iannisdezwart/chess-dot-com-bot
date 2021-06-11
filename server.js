"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var http = require("http");
var child_process_1 = require("child_process");
// Run and set up Stockfish
var stockfish = child_process_1.exec('Stockfish/src/stockfish');
var bestmove = '';
stockfish.stdout.on('data', function (chunk) {
    console.log('Stockfish:', chunk);
    if (chunk.includes('pv')) {
        bestmove = chunk.substr(chunk.lastIndexOf('pv') + 3, 4);
    }
});
stockfish.stdin.write("uci\n");
stockfish.stdin.write("ucinewgame\n");
// Parse request body
var parseJSONBody = function (req) { return new Promise(function (resolve) {
    var body = '';
    req.on('data', function (chunk) { return body += chunk; });
    req.on('end', function () {
        try {
            var bodyObj = JSON.parse(body);
            resolve(bodyObj);
        }
        catch (err) {
            resolve(null);
        }
    });
}); };
var search = function (body, res) {
    var board = body.board;
    if (board == null) {
        res.end('missing body parameters');
        return;
    }
    stockfish.stdin.write("position startpos moves " + board + "\n");
    stockfish.stdin.write("go infinite\n");
    res.end('started searching');
};
var stopSearching = function (res) {
    stockfish.stdin.write("stop\n");
    res.end('stopped searching');
};
var getBestMove = function (res) {
    res.end(bestmove);
};
var server = http.createServer(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var body, type;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, parseJSONBody(req)];
            case 1:
                body = _a.sent();
                console.log(body);
                if (body == null) {
                    res.end('missing body');
                    return [2 /*return*/];
                }
                type = body.type;
                if (body == null || type == null) {
                    res.end('missing body parameters');
                    return [2 /*return*/];
                }
                switch (type) {
                    case 'search':
                        search(body, res);
                        break;
                    case 'stop-searching':
                        stopSearching(res);
                        break;
                    case 'get-best-move':
                        getBestMove(res);
                        break;
                }
                return [2 /*return*/];
        }
    });
}); });
server.listen(1337);
