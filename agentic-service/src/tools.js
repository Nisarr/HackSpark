const axios = require('axios');
const { centralApi } = require('./central-api-client');

const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003';
const RENTAL_URL = process.env.RENTAL_SERVICE_URL || 'http://rental-service:8002';

/**
 * Tool definitions for Groq (OpenAI-compatible)
 */
const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_categories',
      description: 'Fetch all valid rental categories from RentPi.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_info',
      description: 'Fetch information about a RentPi user, including their name and security score which determines discounts.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The ID of the user (e.g., "42")' }
        },
        required: ['userId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_discount',
      description: 'Fetch the specific discount percentage a user is eligible for based on their loyalty score.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The ID of the user (e.g., "42")' }
        },
        required: ['userId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Fetch details about a specific rental product, including price and category.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'The ID of the product (e.g., "123")' }
        },
        required: ['productId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_product_availability',
      description: 'Check if a product is available for rent during a specific date range.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'The ID of the product' },
          from: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
          to: { type: 'string', description: 'End date in YYYY-MM-DD format' }
        },
        required: ['productId', 'from', 'to']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_rental_stats',
      description: 'Fetch overall rental statistics, grouped by category or date.',
      parameters: {
        type: 'object',
        properties: {
          groupBy: { type: 'string', enum: ['category', 'date'], description: 'How to group the stats' },
          month: { type: 'string', description: 'The month to filter by if grouping by date (YYYY-MM format)' }
        },
        required: ['groupBy']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_trends',
      description: 'Fetch trending products, recommendations, and peak rental windows for a given date range.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'The date for recommendations (YYYY-MM-DD)' },
          fromMonth: { type: 'string', description: 'Start month for peak window analysis (YYYY-MM)' },
          toMonth: { type: 'string', description: 'End month for peak window analysis (YYYY-MM)' }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_surge_analysis',
      description: 'Fetch predicted surge days (high demand) for a specific month.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'The month to analyze (YYYY-MM format)' }
        },
        required: ['month']
      }
    }
  }
];

/**
 * Tool implementations
 */
const toolImplementations = {
  get_categories: async () => {
    try {
      const { data } = await centralApi().get('/api/data/categories');
      return data;
    } catch (err) {
      return { error: 'Failed to fetch categories' };
    }
  },

  get_user_info: async ({ userId }) => {
    try {
      const { data } = await centralApi().get(`/api/data/users/${userId}`);
      return data;
    } catch (err) {
      return { error: `Failed to fetch info for user ${userId}` };
    }
  },

  get_user_discount: async ({ userId }) => {
    try {
      const { data } = await axios.get(`http://user-service:8001/users/${userId}/discount`, { timeout: 5000 });
      return data;
    } catch (err) {
      return { error: `Failed to fetch discount for user ${userId}` };
    }
  },

  get_product_details: async ({ productId }) => {
    try {
      const { data } = await centralApi().get(`/api/data/products/${productId}`);
      return data;
    } catch (err) {
      return { error: `Failed to fetch details for product ${productId}` };
    }
  },

  get_product_availability: async ({ productId, from, to }) => {
    try {
      const { data } = await axios.get(`${RENTAL_URL}/rentals/products/${productId}/availability`, {
        params: { from, to },
        timeout: 5000
      });
      return data;
    } catch (err) {
      return { error: `Failed to check availability for product ${productId}` };
    }
  },

  get_rental_stats: async ({ groupBy, month }) => {
    try {
      const params = { group_by: groupBy };
      if (month) params.month = month;
      const { data } = await centralApi().get('/api/data/rentals/stats', { params });
      return data;
    } catch (err) {
      return { error: 'Failed to fetch rental statistics' };
    }
  },

  get_market_trends: async ({ date, fromMonth, toMonth }) => {
    const results = {};
    try {
      const { data: recs } = await axios.get(`${ANALYTICS_URL}/analytics/recommendations`, {
        params: { date, limit: 5 },
        timeout: 5000
      });
      results.recommendations = recs;
    } catch (err) { results.recommendations = { error: 'Failed to fetch recommendations' }; }

    if (fromMonth && toMonth) {
      try {
        const { data: peak } = await axios.get(`${ANALYTICS_URL}/analytics/peak-window`, {
          params: { from: fromMonth, to: toMonth },
          timeout: 5000
        });
        results.peakWindow = peak;
      } catch (err) { results.peakWindow = { error: 'Failed to fetch peak window data' }; }
    }

    return results;
  },

  get_surge_analysis: async ({ month }) => {
    try {
      const { data } = await axios.get(`${ANALYTICS_URL}/analytics/surge-days`, {
        params: { month },
        timeout: 5000
      });
      return data;
    } catch (err) {
      return { error: `Failed to fetch surge analysis for ${month}` };
    }
  }
};

module.exports = { toolDefinitions, toolImplementations };
