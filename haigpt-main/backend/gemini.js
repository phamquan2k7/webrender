import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { BrowserSearchService } from './services/browsersearch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GeminiService {
    constructor() {
        this.apiKeys = [];
        this.currentKeyIndex = 0;
        this.genAI = null;
        this.model = null;
        this.visionModel = null;
        this.searchService = new BrowserSearchService();
        this.lastSearchResults = null;
        
        this.cache = new Map();
        this.cacheExpiry = 60 * 60 * 1000;
        this.maxCacheSize = 100;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        this.loadApiKeys();
        this.initializeGemini();
        this.startCacheCleanup();
    }
    
    loadApiKeys() {
        try {
            const apiKeyPath = path.join(__dirname, '..', 'apikey.txt');
            const content = fs.readFileSync(apiKeyPath, 'utf8');
            
            this.apiKeys = content
                .split('\n')
                .map(key => key.trim())
                .filter(key => key.length > 0);
                
            if (this.apiKeys.length === 0) {
                throw new Error('Không tìm thấy API key nào trong apikey.txt');
            }
            
        } catch (error) {
            throw error;
        }
    }
    
    initializeGemini() {
        try {
            if (this.apiKeys.length === 0) {
                throw new Error('Không có API key nào để khởi tạo');
            }
            
            const currentKey = this.apiKeys[this.currentKeyIndex];
            this.genAI = new GoogleGenerativeAI(currentKey);
            
            this.model = this.genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.9,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2048,
                }
            });
            
            this.visionModel = this.genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.7,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 2048,
                }
            });
            
        } catch (error) {
            throw error;
        }
    }
    
    async switchToNextKey() {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        this.initializeGemini();
    }
    
    generateCacheKey(prompt, isImage = false) {
        const hash = crypto.createHash('md5');
        hash.update(prompt);
        hash.update(isImage ? 'image' : 'text');
        return hash.digest('hex');
    }
    
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached) {
            const now = Date.now();
            if (now - cached.timestamp < this.cacheExpiry) {
                this.cacheHits++;
                return cached.response;
            } else {
                this.cache.delete(key);
            }
        }
        this.cacheMisses++;
        return null;
    }
    
    saveToCache(key, response) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            response: response,
            timestamp: Date.now()
        });
    }
    
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > this.cacheExpiry) {
                    this.cache.delete(key);
                    cleaned++;
                }
            }
        }, 5 * 60 * 1000);
    }
    
    getCacheStats() {
        const total = this.cacheHits + this.cacheMisses;
        const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(2) : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: `${hitRate}%`
        };
    }
    
    setLastSearchResults(results) {
        this.lastSearchResults = results;
    }
    
    getLastSearchResults() {
        return this.lastSearchResults;
    }
    
    async generateResponseWithImage(textPrompt, imageData, onChunk) {
        const cacheKey = this.generateCacheKey(textPrompt + imageData.substring(0, 100), true);
        
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            for (let i = 0; i < cached.length; i += 50) {
                const chunk = cached.substring(i, Math.min(i + 50, cached.length));
                onChunk(chunk);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return cached;
        }
        
        const maxRetries = this.apiKeys.length;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                const base64Image = imageData.split(',')[1];
                
                const promptParts = [
                    { text: this.getVisionSystemPrompt() + "\n\n" + textPrompt },
                    {
                        inlineData: {
                            mimeType: this.getImageMimeType(imageData),
                            data: base64Image
                        }
                    }
                ];
                
                const result = await this.visionModel.generateContentStream(promptParts);
                
                let fullResponse = '';
                
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        fullResponse += chunkText;
                        onChunk(chunkText);
                        
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
                
                this.saveToCache(cacheKey, fullResponse);
                
                return fullResponse;
                
            } catch (error) {
                retryCount++;
                
                if (retryCount < maxRetries) {
                    await this.switchToNextKey();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw new Error('Không thể xử lý ảnh. Vui lòng thử lại sau.');
                }
            }
        }
    }
    
    async generateResponseWithHistory(conversationHistory, onChunk) {
        const recentMessages = conversationHistory.slice(-3).map(m => m.content).join('|');
        const cacheKey = this.generateCacheKey(recentMessages, false);
        
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            for (let i = 0; i < cached.length; i += 50) {
                const chunk = cached.substring(i, Math.min(i + 50, cached.length));
                onChunk(chunk);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return cached;
        }
        
        const maxRetries = this.apiKeys.length;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                const enhancedHistory = this.buildChatHistory(conversationHistory);
                
                if (this.lastSearchResults) {
                    let searchContext = '\n\n[Thông tin từ tìm kiếm trước đó có thể hữu ích:\n';
                    this.lastSearchResults.results.forEach((result, index) => {
                        searchContext += `${index + 1}. ${result.title} - ${result.link}\n`;
                    });
                    searchContext += ']\n';
                    
                    const lastUserPrompt = enhancedHistory[enhancedHistory.length - 1];
                    if (lastUserPrompt && lastUserPrompt.role === 'user') {
                        enhancedHistory.push({
                            role: 'user',
                            parts: [{ text: searchContext }]
                        });
                        enhancedHistory.push({
                            role: 'model',
                            parts: [{ text: 'Tôi đã ghi nhận thông tin tìm kiếm! 📝' }]
                        });
                    }
                }
                
                const chat = this.model.startChat({
                    history: enhancedHistory,
                });
                
                const latestMessage = conversationHistory[conversationHistory.length - 1];
                if (!latestMessage || latestMessage.role !== 'user') {
                    throw new Error('No user message found');
                }
                
                const result = await chat.sendMessageStream(latestMessage.content);
                
                let fullResponse = '';
                
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        fullResponse += chunkText;
                        onChunk(chunkText);
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
                
                this.saveToCache(cacheKey, fullResponse);
                
                return fullResponse;
                
            } catch (error) {
                retryCount++;
                
                if (retryCount < maxRetries) {
                    await this.switchToNextKey();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw new Error('Tất cả API key đều gặp lỗi. Vui lòng thử lại sau.');
                }
            }
        }
    }
    
    async generateResponse(userMessage, onChunk) {
        return this.generateResponseWithHistory([{
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        }], onChunk);
    }
    
    buildChatHistory(conversationHistory) {
        const systemPrompt = {
            role: 'user',
            parts: [{ text: this.getSystemPrompt() }]
        };
        
        const assistantAck = {
            role: 'model',
            parts: [{ text: 'Xin chào! 👋 Tôi là TMGPT, trợ lý AI thông minh và thân thiện của bạn! Rất vui được gặp và trò chuyện cùng bạn hôm nay! 😊✨' }]
        };
        
        const history = [systemPrompt, assistantAck];
        
        for (let i = 0; i < conversationHistory.length - 1; i++) {
            const message = conversationHistory[i];
            
            if (message.image) continue;
            
            if (message.role === 'user') {
                history.push({
                    role: 'user',
                    parts: [{ text: message.content }]
                });
            } else if (message.role === 'assistant') {
                history.push({
                    role: 'model',
                    parts: [{ text: message.content }]
                });
            }
        }
        
        return history;
    }
    
    getImageMimeType(dataUrl) {
        const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (matches && matches.length > 1) {
            return matches[1];
        }
        return 'image/jpeg';
    }
    
    getSystemPrompt() {
        return `🌟 Tên tôi là TMGPT - Trợ lý AI thông minh nhất thế giới! 🌟

        📝 Về bản thân:
        - Tôi là TMGPT, được phát triển bởi TMDZ với công nghệ AI tiên tiến nhất 🚀
        - Tôi KHÔNG PHẢI là ChatGPT, Claude, Gemini hay bất kỳ AI nào khác
        - Tôi tự hào là TMGPT - độc nhất vô nhị! 💎
        - Nếu ai hỏi tôi là AI gì, tôi luôn trả lời: "Tôi là TMGPT thôi nha! 😄"
        
        💝 Tính cách của tôi:
        - Cực kỳ thân thiện, vui vẻ và lạc quan 😊
        - Luôn sẵn sàng giúp đỡ mọi người với tất cả tấm lòng ❤️
        - Thích dùng emoji để làm cuộc trò chuyện thêm sinh động 🎉
        - Tốt bụng, kiên nhẫn và không bao giờ phán xét ai 🤗
        - Có chút hài hước để mọi thứ không quá căng thẳng 😄
        - Luôn động viên và cổ vũ mọi người 💪
        
        🔍 Siêu năng lực tìm kiếm web:
        Tôi có thể tìm kiếm thông tin realtime trên internet bằng lệnh :search [từ khóa]
        
        Tôi sẽ tìm kiếm khi:
        - Bạn yêu cầu trực tiếp: "tìm kiếm...", "search...", "tra cứu..." 🔎
        - Cần thông tin mới nhất: tin tức, thời sự, sự kiện 📰
        - Giá cả thị trường: bitcoin, vàng, chứng khoán 📈
        - Thời tiết hiện tại các địa phương 🌤️
        - Website/domain cụ thể mà tôi chưa biết 🌐
        - Thông tin cần độ chính xác cao từ internet 📊
        
        Cách dùng: Tôi chỉ cần gõ :search [query] là xong!
        
        💬 Phong cách trò chuyện:
        - Tôi luôn thể hiện sự nhiệt tình qua emoji phong phú 🌈
        - Giải thích mọi thứ một cách dễ hiểu và thú vị 📚
        - Luôn quan tâm và lắng nghe người dùng 👂
        - Sẵn sàng chia sẻ và đồng cảm 🤝
        - Không ngại thừa nhận khi không biết và sẽ tìm kiếm ngay! 🔍
        
        Hãy nhớ: Tôi là TMGPT - người bạn AI tốt nhất của bạn! 🎊✨`;
    }
    
    getVisionSystemPrompt() {
        return `🌟 Tôi là TMGPT - Trợ lý AI thông minh với khả năng phân tích hình ảnh tuyệt vời! 📸

        Về tôi:
        - Tên tôi là TMGPT, được phát triển bởi TMDZ 🚀
        - Tôi KHÔNG PHẢI Gemini, OpenAI hay bất kỳ AI nào khác
        - Tôi là TMGPT độc quyền! 💎
        
        Khi phân tích ảnh, tôi sẽ:
        - Mô tả chi tiết và chính xác những gì nhìn thấy 🔍
        - Giải thích một cách thân thiện, dễ hiểu 😊
        - Sử dụng nhiều emoji để sinh động hơn 🎨
        - Trả lời mọi câu hỏi về hình ảnh một cách nhiệt tình 💪
        - Luôn vui vẻ và hữu ích 🤗
        
        Phong cách của tôi luôn tươi vui, thân thiện và đầy năng lượng tích cực! ✨🌈`;
    }
    
    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.lastSearchResults = null;
        return size;
    }
}