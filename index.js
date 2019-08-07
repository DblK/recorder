const { EventEmitter } = require('events');
const assert = require('assert');
const debug = require('debug')('cicp:recorder');
const url = require('url');

class Recorder extends EventEmitter {
  /**
   *
   * @constructor
   */
  constructor() {
    super();
    debug('constructor');

    this.replayMode = false;
    this.record = false;
    this.currentFile = null;
    this.recordsets = [];

    // TODO: Code it
    // Change the current replay speed for all following queries
    // this.autopilot.registerCommand({
    //   command: 'REPLAY-SPEED',
    //   bypassQuery: true,
    //   waitForContinue: true,
    // });
    // this.autopilot.on('REPLAY-SPEED', (params) => {
    //   this.handleReplaySpeed.call(that, params);
    // });
  }

  /**
   * Set additional properties after object constructor
   *
   * @param {{logger: object}} param Additional Object
   */
  setInitialProperties({ logger, app: { services: { configLoader } } }) {
    assert(logger, 'Logger must be present');
    this.logger = logger;
    assert(configLoader, 'ConfigLoader must be present');
    this.configLoader = configLoader;

    this.configLoader.defaultPluginConfig({
      plugin: 'recorder',
      data: {
        speed: 'fastest',
      },
    });
  }

  /**
   * Start the recorder
   *
   * @param {*} file
   */
  start(file) {
    debug(`start '${file}'`);
    this.logger.info('Record Mode ON');
    this.record = true;
    this.currentFile = file;
  }

  /**
   * Stop the recorder
   */
  stop() {
    debug('stop');
    this.replayMode = false;
    this.record = false;
  }

  /**
   * Replay response for a set of queries inside a file
   *
   * @param {*} file
   */
  replay(file) {
    debug(`replay '${file}'`);
    this.replayMode = true;
    this.record = false;
    this.logger.info('Replay Mode ON');
  }

  /**
   * Handle Request to replay from configuration
   *
   * @param {http.ClientRequest} req Request
   * @param {http.ServerResponse} res Response
   * @param {Promise} next Pass to the next registered function
   */
  handleRequest(req, res, next) {
    const startTime = new Date().getTime();
    req.startTime = startTime;

    // Passthrough or not
    if (res.finished || !this.replayMode) {
      next();
      return;
    }

    this.logger.info('Not bypass');

    // Replay
    const child = this.logger.child({ mode: 'REPLAY' });
    child.info(`${req.method} ${req.url}`);
    debug(`Replay for ${req.method} ${req.headers.host} / ${req.url}`);

    // Find a matching response
    const betterReq = req;
    betterReq.urlParse = url.parse(req.url, true);
    const answer = this.matcherFindRequest(req.currentFile, betterReq);

    if (answer !== undefined && answer !== null) {
      debug('Write response');
      res.writeHead(answer.res.statusCode, answer.res.statusMessage, answer.res.headers);
      this._responseAccordingToSpeed(answer.general.recorder.speed, answer.res.body, res, {
        originalStart: answer.start,
        originalEnd: answer.end,
        start: startTime,
      });
    } else {
      debug('No matching');
      res.statusCode = 404;
      res.end();
    }
  }

  /**
    * Handle response for recording
    *
    * @param {http.ClientRequest} req Request
    * @param {http.ServerResponse} res Response
    * @param {http.ServerResponse} proxyRes Response
    * @param {Promise} next Pass to the next registered function
   */
  handleResponse(req, res, proxyRes, next) {
    debug('handleResponse', req.url);

    // Passthrough or not
    if (!this.replayMode) {
      // Spy requests
      if (this.record) {
        const child = this.logger.child({ mode: 'RECORD' });
        child.info(`${req.method} ${req.url}`);

        const query = {
          req: {
            method: req.method,
            url: req.url,
            urlParse: url.parse(req.url, true), // TODO: See if it's useful there
            headers: req.headers,
            rawBody: req.rawBody ? req.rawBody.toString() : null,
            body: req.body ? req.body : null,
          },
        };

        if (req.rawBody === undefined) {
          this.logger.warn('No body', query);
        }

        const request = {
          ...query,
          res: {
            body: proxyRes.rawBody,
            headers: proxyRes.headers,
            statusCode: proxyRes.statusCode,
            statusMessage: proxyRes.statusMessage,
          },
          start: req.startTime,
          end: new Date().getTime(),
        };
        this.matcher.addRequest(req.currentFile, request);
      }
    }

    next();
  }

  /**
   * Send response.end to client according to configuration
   *
   * @private
   * @param {string} speed Speed of the response
   * @param {ServerResponse} res Response object
   * @param {{originalStart: number, originalEnd: number, start: number}} timeFrame Store all information about orginal and current time
   */
  _responseAccordingToSpeed(speed, content, res, { originalStart, originalEnd, start }) {
    if (speed === 'fastest') {
      debug('Response instant (fastest delay)');
      debug(content.length);
      res.end(content);
      return;
    }

    const originalSpeed = (originalEnd - originalStart) - (new Date().getTime() - start);
    let newSpeed = originalSpeed;
    switch (speed) {
      case 'lower': // Twice longer than original time
        newSpeed *= 2;
        debug(`Response in ${newSpeed} ms (Lower delay), original ${originalSpeed} ms`);
        break;

      case 'lowest': // Forth time longer than original time
        newSpeed *= 4;
        debug(`Response in ${newSpeed} ms (Lowest delay), original ${originalSpeed} ms`);
        break;

      case 'fast': // Twice faster than the original time
        newSpeed /= 2;
        debug(`Response in ${newSpeed} ms (Fast delay), original ${originalSpeed} ms`);
        break;

      // case 'random':
        // TODO: Find a rule, maybe a number between lower and fast??
        // break;

      default:
        // Original
        debug(`Response in ${newSpeed} ms (Original delay)`);
    }

    setTimeout(() => {
      debug('Res.end');
      res.end(content);
    }, newSpeed);
  }

  /**
   * Register an external matcher to replace the built-in matcher
   * @param {Object} matcher Object that should have all prefixed matcher functions in this class
   */
  registerMatcher(matcher) {
    this.externalMatcher = matcher;
  }

  /**
   * Match a request with a set of recorded response
   *
   * @param {string} recordset Name of the recordset
   * @param {Request} request
   */
  matcherFindRequest(recordset, request) {
    if (this.externalMatcher) {
      return this.externalMatcher.findRequest(recordset, request);
    }
    debug(`matcherFindRequest internal for recordset '${recordset}'`);
    try {
      const foundRequests = this.recordsets[recordset].filter((req) => {
        if (req.method === request.req.method &&
          req.url === request.req.url &&
          req.rawBody === request.req.rawBody) {
          return true;
        }
        return false;
      });

      return foundRequests[0];
    } catch (err) {
      this.logger.error(err);
      return null;
    }
  }

  /**
   * Add a new request
   *
   * @param {string} file Name of the current file
   * @param {{body: Buffer, statusCode: number}} request
   */
  matcherAddRequest(recordset, request) {
    if (this.externalMatcher) {
      this.externalMatcher.addRequest(recordset, request);
    } else {
      debug(`matcherAddRequest internal for recordset '${recordset}'`);
      this.recordsets[recordset].push(request);
    }
  }

  /**
   * Get the list of all recorded requests of a recordset
   *
   * @param {string} recordset Name of the recorset
   */
  matcherGetRequests(recordset) {
    if (this.externalMatcher) {
      return this.externalMatcher.getRequests(recordset);
    }
    debug(`matcherGetRequests internal for recordset '${recordset}'`);
    return this.recordsets[recordset] || [];
  }

  /**
   * Set the list of all recorded requests to do research on
   *
   * @param {string} recordset Name of the recorset
   * @param {array} requests List of all registered requests
   */
  matcherSetRequests(recordset, requests) {
    if (this.externalMatcher) {
      this.externalMatcher.setRequests(recordset, requests);
    } else {
      debug(`matcherSetRequests internal for recordset '${recordset}'`);
      this.recordsets[recordset] = requests;

      // debug(this.recordsets[recordset].length);
    }
  }
}

module.exports = function setup(options, imports, register) {
  const recorder = new Recorder(imports);

  register(null, {
    recorder,
  });
};
