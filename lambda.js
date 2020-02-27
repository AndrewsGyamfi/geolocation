require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

/**
 * Extract Neustar environment variables from env
 * @param {Object} process.env
 * @return {Object} object with required api constants
 */
const getNeustarEnvConstants = ({ API_HOST, API_KEY, SHARED_SECRET }) => {
  return { API_HOST, API_KEY, SHARED_SECRET };
};

/**
 * Get constants from environment variable
 */
const NEUSTAR = getNeustarEnvConstants(process.env);

/**
 * hasRequiredParams
 * Given any number of params, it should validate
 * whether they're all of truthy values, otherwise, returns false
 * @param {*} params - any number of arguments
 * @return {Boolean} - true if all params have values, false, if one does not
 */
const hasRequiredParams = (...params) => [...params].every(param => !!param);

/**
 * Checks to see given string is valid ip Address
 * Currently basic implementation - checks if ipAddress is not falsy value
 * and is of String type.
 * Future implementation should check string structure to determine
 * ipv4 or ipv6 validity. Or could leverage an existing npm module, if one
 * exists.
 * @param {String} ipAddress
 * @return {Boolean}
 */
const isValidIpAddress = ipAddress => {
  return ipAddress && typeof ipAddress === 'string';
};

/**
 * Create Neustar-specific url based on given ip address
 * Refer to API documentation here: https://ipintelligence.neustar.biz/portal/home#documentation
 * @param {String} ipAddress - ip address for which geo info is required
 * @return {String} url string
 */
const getRequestUrl = ipAddress => {
  const { API_HOST, API_KEY } = NEUSTAR;
  if (!isValidIpAddress(ipAddress) || !hasRequiredParams(API_HOST, API_KEY)) {
    return;
  }
  return `https://${API_HOST}/ipi/gpu/v1/ipinfo/${ipAddress}?apiKey=${API_KEY}&sig=${getDigitalSignature()}&format=json`;
};

/**
 * Generates a SHA-256 digital signature as required by Neustar for valid API calls
 * The digital signature must:
 * 1. be an MD5 OR SHA256 hash and,
 * 2. must be made up of the API key (apikey), the API userâ€™s shared secret, and a UNIX timestamp in seconds
 * @return {String} SHA-256 hash string
 */
const getDigitalSignature = () => {
  const { API_KEY, SHARED_SECRET } = NEUSTAR;
  return createHashString(API_KEY, SHARED_SECRET, getTimeInSeconds());
};

/**
 * Creates a SHA-256 hash based on given parameters
 * @param {String} apiKey - api key you received from Neustar
 * @param {String} sharedSecret - shared secret key
 * @param {Number} timeInSeconds - Unix timestamp in seconds
 * @return {String} hashed string of above listed parameters
 */
const createHashString = (apiKey, sharedSecret, timeInSeconds) => {
  if (!hasRequiredParams(apiKey, sharedSecret, timeInSeconds)) {
    return;
  }
  return crypto
    .createHash('sha256')
    .update(`${apiKey}${sharedSecret}${timeInSeconds}`)
    .digest('hex');
};

/**
 * Get current unix timestamp in seconds
 * Neustar requires timestamp in seconds for digital signature generation.
 * @see createHashString
 * @return {Number} current time in seconds
 */
const getTimeInSeconds = () => {
  return Math.floor(Date.now() / 1000);
};

/**
 * Get given ip address info from Neustar api
 * @param {String} ipAddress - ip address
 * @return {Promise} request promise
 */
const requestInfoFromApi = ipAddress => {
  if (!isValidIpAddress(ipAddress)) {
    return;
  }
  return axios.get(getRequestUrl(ipAddress));
};

/**
 * Accept ip address and request info from api
 * @param {String} ipAddress - ip address
 */
const getIpInfo = ipAddress => {
  if (!isValidIpAddress(ipAddress)) {
    return;
  }
  return requestInfoFromApi(ipAddress);
};

/**
 * Lambda function entry point
 * Grabs ip query paramater from event object,
 * and triggers api call for ip info.
 * @param {Object} event - event object
 * @param {Object} context - context object
 * @param {Function} callback - callback function
 */
exports.handler = (event, _context, callback) => {
  // Grab ip address from query parameter
  const ipAddress = event['queryStringParameters']['ip'];

  // Default error response object
  const errorResponse = {
    statusCode: 400,
    body: 'Please provide a valid ip address.',
  };

  /**
   * Handle successful response from api call
   * @param {Object} response - response from api
   */
  const handleSuccessResponse = ({ data }) => {
    return callback(null, {
      statusCode: 200,
      body: JSON.stringify(data['ipinfo']),
    });
  };

  /**
   * Handle error response from api call
   * @param {Object} error - error response from api call
   */
  const handleErrorResponse = error => {
    return callback(null, errorResponse);
  };

  if (!ipAddress) {
    return handleErrorResponse();
  }
  /**
   * Get ip info
   */
  getIpInfo(ipAddress)
    .then(handleSuccessResponse)
    .catch(handleErrorResponse);
};
