const fs = require('fs');
const filepath = 'c:/Users/Yoosuf/Documents/Open-FPL-Insights/api/requests.js';
let code = fs.readFileSync(filepath, 'utf8');

const cacheLogicHeader = `const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes

const doCORSRequest = async (url) => {
    let endpointUrl = baseURL + url;
    
    // Check cache first
    try {
        const cachedStr = sessionStorage.getItem(\`fpl_cache_\${url}\`);
        if (cachedStr) {
            const cachedData = JSON.parse(cachedStr);
            // Check expiry
            if (Date.now() - cachedData.timestamp < CACHE_EXPIRY) {
                // Instantly update progress bar if it's a main request so the UI doesn't hang waiting for it
                if (['bootstrap-static/', 'fixtures/', 'events/'].includes(url) && window.globalFplLoadedBytes !== undefined) {
                    let estimatedTotal = url === 'bootstrap-static/' ? 1594800 : (url === 'fixtures/' ? 131500 : 27000);
                    window.globalFplLoadedBytes += estimatedTotal;
                    let percent = Math.min(Math.round((window.globalFplLoadedBytes / window.globalFplTotalBytes) * 100), 100);
                    const progressEl = document.getElementById('global-progress-bar');
                    if (progressEl) progressEl.style.width = percent + '%';
                }
                return cachedData.data;
            } else {
                sessionStorage.removeItem(\`fpl_cache_\${url}\`);
            }
        }
    } catch (e) {
        console.warn('Cache read error:', e);
    }

    let lastError = null;`;

code = code.replace(`const doCORSRequest = async (url) => {
    let endpointUrl = baseURL + url;
    let lastError = null;`, cacheLogicHeader);

const cacheLogicFooter1 = `                const result = new TextDecoder("utf-8").decode(chunksAll);
                const myJson = JSON.parse(result);
                currentProxyIndex = i;
                
                try {
                    sessionStorage.setItem(\`fpl_cache_\${url}\`, JSON.stringify({ timestamp: Date.now(), data: myJson }));
                } catch (e) {
                    console.warn('Cache write error:', e);
                }
                
                return myJson;`;

code = code.replace(`                const result = new TextDecoder("utf-8").decode(chunksAll);
                const myJson = JSON.parse(result);
                currentProxyIndex = i;
                return myJson;`, cacheLogicFooter1);

const cacheLogicFooter2 = `            // For other small requests, just use standard json()
            const myJson = await response.json();
            currentProxyIndex = i; // Save successful proxy index
            
            try {
                sessionStorage.setItem(\`fpl_cache_\${url}\`, JSON.stringify({ timestamp: Date.now(), data: myJson }));
            } catch (e) {
                console.warn('Cache write error:', e);
            }
            
            return myJson;`;

code = code.replace(`            // For other small requests, just use standard json()
            const myJson = await response.json();
            currentProxyIndex = i; // Save successful proxy index
            return myJson;`, cacheLogicFooter2);

fs.writeFileSync(filepath, code);
console.log("requests.js successfully updated with caching");
