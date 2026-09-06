import { processLocalQuery } from './src/services/localAIService.js';
import { loadJson } from './src/utils/localDB.js';

(async () => {
    try {
        const qLower = 'find out the latest sale price of a4 paper';
        const stopWords = ['what', 'is', 'the', 'purchase', 'price', 'of', 'sale', 'how', 'much', 'does', 'cost', 'find', 'out', 'search', 'item', 'with', 'selling', 'rate', 'latest', 'last', 'first', 'show', 'me', 'tell', 'about', 'for', 'any'];
        const searchWordsFallback = (qLower.match(/[a-z0-9]+/gi) || []).filter(w => w.length > 1 && !stopWords.includes(w));
        console.log({searchWordsFallback});

        // Let's mock loadJson to return an item
        // Wait, local DB in memory might be empty if we're not running the frontend!
        // Right! STORAGE_KEYS.ITEMS reads from localStorage!
        // In Node, localStorage is undefined or empty!
    } catch(e) {
        console.error(e);
    }
})();
