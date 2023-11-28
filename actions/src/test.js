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
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
var axios = require('axios');
var DataProviderAbi = require('../jsons/data-provider.json');
var ethers = require('ethers');
dotenv.config();
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var token, pagerDuty, DATA_PROVIDER_ADDRESS, provider, dataProvider, rawOutput, labels, formattedData, url, headers, data, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = process.env.TENDERLY_ACCESS_KEY;
                pagerDuty = process.env.PAGERDUTY_ACCESS_KEY;
                DATA_PROVIDER_ADDRESS = "0xFc21d6d146E6086B8359705C8b28512a983db0cb";
                // Log out all keys in ethers
                console.log(Object.keys(ethers));
                provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
                dataProvider = new ethers.Contract(DATA_PROVIDER_ADDRESS, DataProviderAbi, provider);
                return [4 /*yield*/, dataProvider.getReserveData("0x6b175474e89094c44da98b954eedeac495271d0f")];
            case 1:
                rawOutput = _a.sent();
                labels = [
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
                console.dir(Object.keys(ethers), { depth: null });
                formattedData = rawOutput.map(function (value, index) { return ({
                    label: labels[index],
                    value: BigInt(value).toString(),
                }); });
                console.log(formattedData);
                url = 'https://events.pagerduty.com/v2/enqueue';
                headers = {
                    'Content-Type': 'application/json',
                };
                data = {
                    payload: {
                        summary: formattedData[0].value,
                        severity: 'critical',
                        source: 'Alert source',
                    },
                    routing_key: pagerDuty,
                    event_action: 'trigger',
                };
                return [4 /*yield*/, axios.post(url, data, { headers: headers })];
            case 2:
                response = _a.sent();
                console.log(response);
                return [2 /*return*/];
        }
    });
}); };
main();
