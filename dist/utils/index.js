"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promisfy = void 0;
const assert_1 = require("assert");
function promisfy(fn, thisObj) {
    return async function (...args) {
        return new Promise((resolve, reject) => {
            fn.call(thisObj, ...args, (err, d) => {
                if (err) {
                    assert_1.rejects(err);
                }
                else {
                    resolve(d);
                }
            });
        });
    };
}
exports.promisfy = promisfy;
//# sourceMappingURL=index.js.map