import { processLocalQuery } from './src/services/localAIService.js';

(async () => {
    try {
        const res = await processLocalQuery('find out the latest sale price of A4 paper');
        console.log(res);
    } catch(e) {
        console.error(e);
    }
})();
