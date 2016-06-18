"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createMomentObjectWithSpecificTimeZone = createMomentObjectWithSpecificTimeZone;

var _momentTimezone = require("moment-timezone");

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * this creates a moment object that takes in a timestamp
 * makes it timestamp neutral, then creates a moment-timezone obj
 * with your passed in timezone
 * @param  {string} timestamp "YYYY-MM-DDTHH:mm:ss.SSS-ZZ"
 * @param  {string} timezone  "America_Los_Angeles"
 * @return {moment}           object with time matched to that specific tz
 */
function createMomentObjectWithSpecificTimeZone(timeStamp, timeZone) {
  var timeStampArray = timeStamp.split("-");
  timeStampArray.pop();
  timeStamp = timeStampArray.join("-");
  var momentTimezone = _momentTimezone2.default.tz(timeStamp, timeZone);
  return momentTimezone;
}
//# sourceMappingURL=miscHelpers.js.map