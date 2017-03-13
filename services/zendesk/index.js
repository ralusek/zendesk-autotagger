'use strict';

'use strict';

const Promise = require('bluebird');
const _ = require('lodash');
const request = require('request-promise');


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}


/**
 *
 */
module.exports = class Zendesk {
  /**
   *
   */
  constructor(config) {
    config = config || {};

    const apiKey = p(this).apiKey = config.apiKey;
    if (!apiKey) throw new Error('No API key provided for Zendesk.');

    const accountEmail = p(this).accountEmail = config.accountEmail;
    if (!accountEmail) throw new Error('No accountEmail provided for Zendesk.');

    const domain = p(this).domain = config.domain;
    if (!domain) throw new Error('No domain provided for Zendesk.');

    // const tagFormatter = p(this).tagFormatter || (key, value) => `${key}:${value}`;
  }


  /**
   * List all non-closed tickets from Zendesk.
   * Paginates all into memory.
   */
  listTickets(page) {
    page = page || 1;
    const url = `https://${p(this).domain}.zendesk.com/api/v2/search.json?page=${page}&query=type:ticket status:open status:pending status:solved status:hold`;
    const auth = `${p(this).accountEmail}/token:${p(this).apiKey}`;
    const params = {
      url,
      method: 'GET',
      headers: {
        Authorization: `Basic ${(new Buffer(auth).toString('base64'))}`
      }
    };

    return request.get(params)
    .then(response => {
      const parsed = JSON.parse(response);
      const results = _.get(parsed, 'results', []);
      // There are assumed to be additional pages until results is empty.
      if (results.length) {
        return this.listTickets(page + 1)
        .then(nextResults => results.concat(nextResults));
      }
      return results;
    });
  }


  /**
   *
   */
  updateTicketTags(ticketId, content) {
    const auth = `${p(this).accountEmail}/token:${p(this).apiKey}`;
    const url = `https://${p(this).domain}.zendesk.com/api/v2/tickets/${ticketId}.json`;
    return request({
      url: url,
      method: 'PUT',
      headers: {
        Authorization: `Basic ${(new Buffer(auth).toString('base64'))}`
      },
      body: {ticket: {tags: _.get(content, 'tags', [])}},
      json: true
    });
  }
}
