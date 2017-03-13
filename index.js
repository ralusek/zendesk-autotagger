'use strict';

const Promise = require('bluebird');
const _ = require('lodash');
const request = require('request-promise');

const WitAI = require('./services/wit-ai');
const Zendesk = require('./services/zendesk');


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}


/**
 * TODO:
 * Change the execution such that each phase doesn't rely on the previous phase
 * fully completing. i.e. Next update will begin tagging from wit.ai as zendesk
 * results come in, rather than waiting for all of them to come in and then tag
 * them.
 */
module.exports = class ZendeskAutotagger {
  /**
   *
   */
  constructor(config) {
    config = config || {};

    p(this).logger = {
      notice: _.get(config, 'logger.notice'),
      error: _.get(config, 'logger.error')
    }

    const zendeskConfig = _.get(config, 'zendesk');
    if (!zendeskConfig) throw new Error('No zendesk configuration provided to ZendeskAutotagger.');

    const witAIConfig = _.get(config, 'witAI');
    if (!witAIConfig) throw new Error('No witAI configuration provided to ZendeskAutotagger.');

    p(this).tagFormatter = _.get(config, 'tagFormatter', (key, value) => `${key}:${value}`);

    p(this).service = {
      zendesk: new Zendesk(zendeskConfig),
      witAI: new WitAI(witAIConfig)
    };
  }


  /**
   *
   */
  getAutotaggedDescriptions(config) {
    config = config || {};

    return p(this).service.zendesk.listTickets()
    .then(tickets => {
      // Let it be known that there is a shorter way of doing this, but I left
      // it like this for legitibility.
      if (config.descriptionFormatter) {
        tickets.forEach(ticket => {
          ticket.description = config.descriptionFormatter(_.get(ticket, 'description'));
        });
      }
      
      return Promise.map(tickets, ticket => {
        return p(this).service.witAI.getEntitiesFromText(_.get(ticket, 'description'))
        // Catch and ignore witAI errors.
        .catch(err => {
          if (p(this).logger.error)
          p(this).logger.error(`Wit Error for ticket: ${ticket}`, err && err.stack);
          return [];
        })
        .then(entities => ({ticket, entities}));
      });
    });
  }


  /**
   *
   */
  autotagTickets(config) {
    return this.getAutotaggedDescriptions(config)
    .then(taggedTickets => {
      const tagFormatter = config.tagFormatter || p(this).tagFormatter;
      return Promise.map(taggedTickets, (taggedTicket) => {
        const ticket = _.get(taggedTicket, 'ticket');
        const ticketId = _.get(taggedTicket, 'ticket.id');
        const existingTags = _.get(taggedTicket, 'ticket.tags', []);
        const newWitTags = _.get(taggedTicket, 'entities', []).map(entity => {
          return tagFormatter(_.get(entity, 'key'), _.get(entity, 'value'));
        });

        ticket.tags = _.uniq(existingTags.concat(newWitTags));
        return p(this).service.zendesk.updateTicketTags(ticketId, ticket);
      });
    });
  }
}
