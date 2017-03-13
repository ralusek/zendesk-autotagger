'use strict';

const Promise = require('bluebird');
const _ = require('lodash');
const witAI = require('node-wit');
const Wit = witAI.Wit;


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}


/**
 *
 */
module.exports = class WitAI {
  /**
   *
   */
  constructor(config) {
    config = config || {};

    const apiKey = config.apiKey;
    if (!apiKey) throw new Error('No API key provided for WitAI.');

    p(this).client = new Wit({accessToken: apiKey});

    // Sets globaly minimum confidence threshold.
    const minConfidenceThreshold = config.minConfidenceThreshold;
    p(this).minConfidenceThreshold = validateMinConfidenceThreshold(minConfidenceThreshold);
  }


  /**
   * Get WitAI entitites from text which have higher confidence than minimum
   * threshold.
   */
  getEntitiesFromText(text, config) {
    if (!text) return Promise.resolve({});

    config = config || {};

    return p(this).client.message(text)
    .then(response => _.get(response, 'entities', {}))
    .then(entities => {
      const minConfidenceThreshold = validateMinConfidenceThreshold(_.get(config, 'minConfidenceThreshold')) ||
                                     p(this).minConfidenceThreshold;

      const validEntities = [];
      _.forOwn(entities, (entityValues, key) => {
        entityValues.forEach(entityValue => {
          const confidence = Number(_.get(entityValue, 'confidence', 0));
          if (entityValue.confidence < minConfidenceThreshold) return;
          validEntities.push({
            key,
            value: _.get(entityValue, 'value'),
            confidence
          });
        });
      });

      return validEntities;
    });
  }
}


/**
 * Take provided threshold and ensure that it is between 0 and 1.
 */
function validateMinConfidenceThreshold(threshold) {
  threshold = threshold || 0;
  if (threshold < 0 || threshold > 1) {
    throw new Error(`Provided confidence threshold ${threshold} is not a value between 0 and 1.`);
  }

  return threshold;
}
