import moment from 'moment-timezone';

/**
 * this creates a moment object that takes in a timestamp
 * makes it timestamp neutral, then creates a moment-timezone obj
 * with your passed in timezone
 * @param  {string} timestamp "YYYY-MM-DDTHH:mm:ss.SSS-ZZ"
 * @param  {string} timezone  "America_Los_Angeles"
 * @return {moment}           object with time matched to that specific tz
 */
export function createMomentObjectWithSpecificTimeZone(timeStamp, timeZone) {
	var timeStampArray = timeStamp.split("-");
	timeStampArray.pop();
	timeStamp = timeStampArray.join("-");
	var momentTimezone = moment.tz(timeStamp, timeZone);
	return momentTimezone;
}

export function dateStringWithoutTimeZone(dateString) {
	var dateArray = dateString.split("-");
  dateArray.pop();
  return dateArray.join("-");
};