import fetch from 'node-fetch';

export class BrowserSearchService {
    constructor() {
        this.googleApiKey = 'AIzaSyBRB5ll0gqWdDyEtFM-BzVNVbVCIErYcZg';
        this.googleCxId = '25f758dea4e1d468f';
    }
    
    async searchGoogle(query, maxResults = 3) {
        try {
            const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleCxId}&q=${encodeURIComponent(query)}&num=${maxResults}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Google search failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                return [];
            }
            
            return data.items.slice(0, maxResults).map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet,
                displayLink: item.displayLink
            }));
        } catch (error) {
            return [];
        }
    }
    
    async searchWithResults(query) {
        try {
            const searchResults = await this.searchGoogle(query);
            
            if (searchResults.length === 0) {
                return {
                    success: false,
                    message: 'Không tìm thấy kết quả nào',
                    results: []
                };
            }
            
            return {
                success: true,
                query: query,
                results: searchResults
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi tìm kiếm',
                results: []
            };
        }
    }
}

export default BrowserSearchService;