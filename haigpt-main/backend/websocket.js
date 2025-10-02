import { GeminiService } from './gemini.js';
import { userOps, sessionOps, chatOps } from './database.js';
import cookie from 'cookie';

const geminiService = new GeminiService();
const activeConnections = new Map();

export function handleWebSocketConnection(ws, request) {
    ws.isAlive = true;
    ws.user = null;
    ws.currentChatId = null;
    
    authenticateWebSocket(ws, request);
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'user_message':
                    await handleUserMessage(
                        ws, 
                        message.content, 
                        message.image || null,
                        message.chatId || ws.currentChatId
                    );
                    break;
                    
                case 'set_active_chat':
                    ws.currentChatId = message.chatId;
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                    
                default:
                    break;
            }
            
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Không thể xử lý tin nhắn'
            }));
        }
    });
    
    ws.on('close', () => {
        if (ws.user) {
            activeConnections.delete(ws.user.id);
        }
    });
    
    ws.on('error', (error) => {
    });
    
    ws.on('pong', () => {
        ws.isAlive = true;
    });
}

async function authenticateWebSocket(ws, request) {
    try {
        const cookies = cookie.parse(request.headers.cookie || '');
        const authToken = cookies.auth_token;
        
        if (!authToken) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Không có quyền truy cập. Vui lòng đăng nhập.'
            }));
            return;
        }
        
        const session = await sessionOps.findSession(authToken);
        if (!session) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
            }));
            return;
        }
        
        const user = await userOps.getUserById(session.user_id);
        if (!user) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Không tìm thấy thông tin người dùng.'
            }));
            return;
        }
        
        ws.user = user;
        activeConnections.set(user.id, ws);
        
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Lỗi xác thực'
        }));
    }
}

async function handleUserMessage(ws, content, imageData = null, chatId = null) {
    if (!ws.user) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Chưa đăng nhập'
        }));
        return;
    }
    
    if (!chatId) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Vui lòng chọn một cuộc trò chuyện'
        }));
        return;
    }
    
    try {
        const chat = await chatOps.getChat(chatId, ws.user.id);
        if (!chat) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Chat không tồn tại hoặc bạn không có quyền truy cập'
            }));
            return;
        }
        
        let attachmentData = null;
        if (imageData) {
            attachmentData = {
                type: 'image',
                preview: imageData.substring(0, 200) + '...',
                size: imageData.length,
                mimeType: imageData.match(/^data:([^;]+);/)?.[1] || 'image/jpeg'
            };
        }
        
        const userMessage = {
            id: Date.now(),
            sender: 'user',
            content: content,
            attachment: attachmentData,
            timestamp: new Date().toISOString()
        };
        
        const messages = chat.messages || [];
        messages.push(userMessage);
        
        await chatOps.updateConversation(chatId, ws.user.id, messages);
        
        ws.send(JSON.stringify({
            type: 'ai_thinking'
        }));
        
        const recentMessages = messages.slice(-20);
        
        const conversationHistory = recentMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content,
            image: msg.attachment && msg.attachment.type === 'image' ? true : false,
            timestamp: msg.timestamp
        }));
        
        let aiResponse = '';
        let fullAIResponse = '';
        let searchPerformed = false;
        let searchData = null;
        
        if (imageData) {
            aiResponse = await geminiService.generateResponseWithImage(
                content,
                imageData,
                (chunk) => {
                    ws.send(JSON.stringify({
                        type: 'ai_chunk',
                        content: chunk,
                        chatId: chatId
                    }));
                }
            );
        } else {
            aiResponse = await geminiService.generateResponseWithHistory(
                conversationHistory, 
                (chunk) => {
                    fullAIResponse += chunk;
                    
                    const searchMatch = fullAIResponse.match(/:search\s+([^\n]+)/);
                    if (searchMatch && !searchPerformed) {
                        searchPerformed = true;
                        return;
                    }
                    
                    if (!searchPerformed) {
                        ws.send(JSON.stringify({
                            type: 'ai_chunk',
                            content: chunk,
                            chatId: chatId
                        }));
                    }
                }
            );
            
            const searchMatch = aiResponse.match(/:search\s+([^\n]+)/);
            if (searchMatch) {
                const searchQuery = searchMatch[1].trim();
                
                ws.send(JSON.stringify({
                    type: 'search_started',
                    query: searchQuery,
                    chatId: chatId
                }));
                
                const searchResults = await geminiService.searchService.searchWithResults(searchQuery);
                
                geminiService.setLastSearchResults(searchResults);
                
                searchData = {
                    status: 'complete',
                    query: searchQuery,
                    results: searchResults.results.map(r => ({
                        title: r.title,
                        link: r.link,
                        snippet: r.snippet,
                        displayLink: r.displayLink,
                        hasScreenshot: false
                    }))
                };
                
                ws.send(JSON.stringify({
                    type: 'search_results',
                    query: searchQuery,
                    results: searchData.results,
                    chatId: chatId
                }));
                
                ws.send(JSON.stringify({
                    type: 'search_complete',
                    chatId: chatId
                }));
                
                let searchContext = '\n\n📊 Kết quả tìm kiếm:\n';
                searchResults.results.forEach((result, index) => {
                    searchContext += `\n${index + 1}. 📌 ${result.title}\n`;
                    searchContext += `   🔗 URL: ${result.link}\n`;
                    searchContext += `   📝 ${result.snippet}\n`;
                });
                
                const enhancedHistory = [...conversationHistory];
                enhancedHistory.push({
                    role: 'user',
                    content: `[🔍 Kết quả tìm kiếm cho "${searchQuery}":${searchContext}]\n\n✨ Dựa vào thông tin tìm kiếm được, hãy trả lời câu hỏi ban đầu của người dùng một cách chi tiết, chính xác và thân thiện nhé! Hãy dùng emoji cho sinh động! 😊`,
                    timestamp: new Date().toISOString()
                });
                
                aiResponse = await geminiService.generateResponseWithHistory(
                    enhancedHistory,
                    (chunk) => {
                        ws.send(JSON.stringify({
                            type: 'ai_chunk',
                            content: chunk,
                            chatId: chatId
                        }));
                    }
                );
            }
        }
        
        const aiMessage = {
            id: Date.now() + 1,
            sender: 'assistant',
            content: aiResponse,
            attachment: null,
            searchData: searchData,
            timestamp: new Date().toISOString()
        };
        
        messages.push(aiMessage);
        
        await chatOps.updateConversation(chatId, ws.user.id, messages);
        
        ws.send(JSON.stringify({
            type: 'ai_complete',
            chatId: chatId
        }));
        
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'TMGPT đang gặp sự cố. Vui lòng thử lại sau! 😔'
        }));
    }
}

setInterval(() => {
    activeConnections.forEach((ws) => {
        if (!ws.isAlive) {
            ws.terminate();
            return;
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

export { activeConnections };