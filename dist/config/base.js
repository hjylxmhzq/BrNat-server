"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.koaConfig = exports.frpServerConfig = void 0;
exports.frpServerConfig = {
    bindPort: 9998,
    bindAddr: '0.0.0.0',
    restartDelay: 100,
    token: '12345678',
    portRange: [10050, 12050],
};
exports.koaConfig = {
    port: 6060,
    host: '0.0.0.0'
};
//# sourceMappingURL=base.js.map