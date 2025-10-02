import fetch from 'node-fetch';

const D1_CONFIG = {
    accountId: '1d9d9358052b3d4aa9e15c3f3566ed5e',
    databaseId: 'e2f353a4-89b4-4339-8a7a-1dc38b95ce62',
    apiToken: 'M6taEsKDW2DC0DA-os1ex64SH3zeHOC4PZmjGPVW'
};

async function executeD1Query(sql, params = []) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${D1_CONFIG.accountId}/d1/database/${D1_CONFIG.databaseId}/query`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${D1_CONFIG.apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sql: sql,
                params: params
            })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.errors?.[0]?.message || 'D1 query failed');
        }

        return {
            success: true,
            result: data.result[0],
            meta: data.result[0]?.meta || {}
        };
    } catch (error) {
        console.error('D1 Query Error:', error);
        return {
            success: false,
            error: error.message,
            result: null
        };
    }
}

async function checkAndAddSearchDataColumn() {
    try {
        const checkResult = await executeD1Query(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='messages'
        `);
        
        if (checkResult.success && checkResult.result?.results?.length > 0) {
            const tableSchema = checkResult.result.results[0].sql;
            
            if (!tableSchema.includes('search_data')) {
                console.log('🔄 Adding search_data column to messages table...');
                
                const alterResult = await executeD1Query(`
                    ALTER TABLE messages 
                    ADD COLUMN search_data TEXT DEFAULT NULL
                `);
                
                if (alterResult.success) {
                    console.log('✅ search_data column added successfully');
                } else {
                    console.log('⚠️ Could not add search_data column:', alterResult.error);
                }
            }
        }
    } catch (error) {
        console.error('Error checking/adding search_data column:', error);
    }
}

async function migrateConversationsToMessages() {
    try {
        console.log('🔄 Starting migration of conversations to messages table...');
        
        const chatsResult = await executeD1Query(`
            SELECT id, user_id, conversation 
            FROM chats 
            WHERE conversation IS NOT NULL AND conversation != '[]'
        `);
        
        if (!chatsResult.success || !chatsResult.result?.results) {
            console.log('No chats to migrate');
            return;
        }
        
        const chats = chatsResult.result.results;
        let totalMigrated = 0;
        
        for (const chat of chats) {
            try {
                const messages = JSON.parse(chat.conversation || '[]');
                
                if (messages.length > 0) {
                    for (const msg of messages) {
                        const attachmentData = msg.attachment ? JSON.stringify(msg.attachment) : null;
                        const searchDataStr = msg.searchData ? JSON.stringify(msg.searchData) : null;
                        
                        await executeD1Query(`
                            INSERT INTO messages (
                                chat_id, 
                                sender, 
                                content, 
                                attachment,
                                search_data,
                                created_at
                            ) VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            chat.id,
                            msg.sender || 'user',
                            msg.content || '',
                            attachmentData,
                            searchDataStr,
                            msg.timestamp || msg.created_at || new Date().toISOString()
                        ]);
                        totalMigrated++;
                    }
                    
                    await executeD1Query(`
                        UPDATE chats 
                        SET conversation = '[]' 
                        WHERE id = ?
                    `, [chat.id]);
                    
                    console.log(`✅ Migrated ${messages.length} messages from chat ${chat.id}`);
                }
            } catch (error) {
                console.error(`Error migrating chat ${chat.id}:`, error);
            }
        }
        
        console.log(`✅ Migration completed! Total messages migrated: ${totalMigrated}`);
    } catch (error) {
        console.error('Migration error:', error);
    }
}

async function initDatabase() {
    try {
        await executeD1Query(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                avatar TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await executeD1Query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                auth_token TEXT UNIQUE NOT NULL,
                csrf_token TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        await executeD1Query(`
            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                conversation TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        await executeD1Query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                sender TEXT NOT NULL DEFAULT 'user',
                content TEXT NOT NULL,
                attachment TEXT DEFAULT NULL,
                search_data TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
            )
        `);
        
        await executeD1Query(`
            CREATE TABLE IF NOT EXISTS suspensions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                reason TEXT DEFAULT NULL,
                suspended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                delete_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        await executeD1Query(`CREATE INDEX IF NOT EXISTS idx_user_id ON chats(user_id)`);
        await executeD1Query(`CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id)`);
        await executeD1Query(`CREATE INDEX IF NOT EXISTS idx_delete_at ON suspensions(delete_at)`);
        
        console.log('✅ D1 Database initialized successfully');
        
        await checkAndAddSearchDataColumn();
        
        await migrateConversationsToMessages();
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

export const userOps = {
    async createUser(username, password) {
        try {
            const result = await executeD1Query(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, password]
            );
            
            if (result.success) {
                return { success: true, userId: result.meta.last_row_id };
            }
            
            if (result.error?.includes('UNIQUE')) {
                return { success: false, error: 'Username already exists' };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async findUser(username) {
        try {
            const result = await executeD1Query(
                'SELECT id, username, password FROM users WHERE username = ?',
                [username]
            );
            
            if (result.success && result.result?.results?.length > 0) {
                return result.result.results[0];
            }
            return null;
        } catch (error) {
            console.error('Find user error:', error);
            return null;
        }
    },
    
    async getUserById(userId) {
        try {
            const result = await executeD1Query(
                'SELECT id, username, avatar, created_at FROM users WHERE id = ?',
                [userId]
            );
            
            if (result.success && result.result?.results?.length > 0) {
                return result.result.results[0];
            }
            return null;
        } catch (error) {
            console.error('Get user by ID error:', error);
            return null;
        }
    },
    
    async updateAvatar(userId, avatar) {
        try {
            const result = await executeD1Query(
                'UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [avatar, userId]
            );
            
            return { success: result.success };
        } catch (error) {
            console.error('Update avatar error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async updatePassword(userId, password) {
        try {
            const result = await executeD1Query(
                'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [password, userId]
            );
            
            return { success: result.success };
        } catch (error) {
            console.error('Update password error:', error);
            return { success: false, error: error.message };
        }
    }
};

export const sessionOps = {
    async createSession(userId, authToken, csrfToken, expiresAt) {
        try {
            const result = await executeD1Query(
                'INSERT INTO sessions (user_id, auth_token, csrf_token, expires_at) VALUES (?, ?, ?, ?)',
                [userId, authToken, csrfToken, expiresAt.toISOString()]
            );
            
            return result.success;
        } catch (error) {
            console.error('Create session error:', error);
            return false;
        }
    },
    
    async findSession(authToken) {
        try {
            const result = await executeD1Query(
                `SELECT * FROM sessions WHERE auth_token = ? AND expires_at > datetime('now')`,
                [authToken]
            );
            
            if (result.success && result.result?.results?.length > 0) {
                return result.result.results[0];
            }
            return null;
        } catch (error) {
            console.error('Find session error:', error);
            return null;
        }
    },
    
    async deleteSession(authToken) {
        try {
            const result = await executeD1Query(
                'DELETE FROM sessions WHERE auth_token = ?',
                [authToken]
            );
            
            return result.success;
        } catch (error) {
            console.error('Delete session error:', error);
            return false;
        }
    },
    
    async deleteUserSessions(userId) {
        try {
            const result = await executeD1Query(
                'DELETE FROM sessions WHERE user_id = ?',
                [userId]
            );
            
            return result.success;
        } catch (error) {
            console.error('Delete user sessions error:', error);
            return false;
        }
    },
    
    async cleanExpiredSessions() {
        try {
            const result = await executeD1Query(
                `DELETE FROM sessions WHERE expires_at <= datetime('now')`
            );
            
            if (result.success) {
                return { success: true, deleted: result.meta.changes || 0 };
            }
            return { success: false, error: result.error };
        } catch (error) {
            console.error('Clean expired sessions error:', error);
            return { success: false, error: error.message };
        }
    }
};

export const messageOps = {
    async addMessage(chatId, sender, content, attachment = null, searchData = null) {
        try {
            const attachmentStr = attachment ? (typeof attachment === 'string' ? attachment : JSON.stringify(attachment)) : null;
            const searchDataStr = searchData ? (typeof searchData === 'string' ? searchData : JSON.stringify(searchData)) : null;
            
            const result = await executeD1Query(
                'INSERT INTO messages (chat_id, sender, content, attachment, search_data) VALUES (?, ?, ?, ?, ?)',
                [chatId, sender, content, attachmentStr, searchDataStr]
            );
            
            if (result.success) {
                await executeD1Query(
                    'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [chatId]
                );
                
                return { success: true, messageId: result.meta.last_row_id };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            console.error('Add message error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async getChatMessages(chatId) {
        try {
            const result = await executeD1Query(
                'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC',
                [chatId]
            );
            
            if (result.success && result.result?.results) {
                return result.result.results.map(msg => ({
                    ...msg,
                    attachment: msg.attachment ? JSON.parse(msg.attachment) : null,
                    searchData: msg.search_data ? JSON.parse(msg.search_data) : null
                }));
            }
            return [];
        } catch (error) {
            console.error('Get chat messages error:', error);
            return [];
        }
    },
    
    async deleteMessage(messageId, chatId) {
        try {
            const result = await executeD1Query(
                'DELETE FROM messages WHERE id = ? AND chat_id = ?',
                [messageId, chatId]
            );
            
            return result.success && result.meta.changes > 0;
        } catch (error) {
            console.error('Delete message error:', error);
            return false;
        }
    },
    
    async clearChatMessages(chatId) {
        try {
            const result = await executeD1Query(
                'DELETE FROM messages WHERE chat_id = ?',
                [chatId]
            );
            
            if (result.success) {
                await executeD1Query(
                    'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [chatId]
                );
            }
            
            return result.success;
        } catch (error) {
            console.error('Clear chat messages error:', error);
            return false;
        }
    },
    
    async countChatMessages(chatId) {
        try {
            const result = await executeD1Query(
                'SELECT COUNT(*) as count FROM messages WHERE chat_id = ?',
                [chatId]
            );
            
            if (result.success && result.result?.results?.length > 0) {
                return result.result.results[0].count || 0;
            }
            return 0;
        } catch (error) {
            console.error('Count chat messages error:', error);
            return 0;
        }
    }
};

export const chatOps = {
    async createChat(userId, name) {
        try {
            const result = await executeD1Query(
                'INSERT INTO chats (user_id, name) VALUES (?, ?)',
                [userId, name]
            );
            
            if (result.success) {
                return { success: true, chatId: result.meta.last_row_id };
            }
            return { success: false, error: result.error };
        } catch (error) {
            console.error('Create chat error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async getUserChats(userId) {
        try {
            const result = await executeD1Query(`
                SELECT 
                    c.id,
                    c.user_id,
                    c.name,
                    c.created_at,
                    c.updated_at,
                    COUNT(m.id) as message_count
                FROM chats c
                LEFT JOIN messages m ON c.id = m.chat_id
                WHERE c.user_id = ?
                GROUP BY c.id
                ORDER BY c.updated_at DESC
            `, [userId]);
            
            if (!result.success || !result.result?.results) {
                return [];
            }
            
            const chatsWithMessages = await Promise.all(
                result.result.results.map(async (chat) => {
                    const messages = await messageOps.getChatMessages(chat.id);
                    return {
                        ...chat,
                        messages: messages,
                        message_count: messages.length
                    };
                })
            );
            
            return chatsWithMessages;
        } catch (error) {
            console.error('Get user chats error:', error);
            return [];
        }
    },
    
    async getChat(chatId, userId) {
        try {
            const result = await executeD1Query(
                'SELECT * FROM chats WHERE id = ? AND user_id = ?',
                [chatId, userId]
            );
            
            if (!result.success || !result.result?.results?.length) {
                return null;
            }
            
            const chat = result.result.results[0];
            const messages = await messageOps.getChatMessages(chatId);
            
            return {
                ...chat,
                messages: messages,
                message_count: messages.length
            };
        } catch (error) {
            console.error('Get chat error:', error);
            return null;
        }
    },
    
    async updateConversation(chatId, userId, messages) {
        try {
            const chat = await this.getChat(chatId, userId);
            if (!chat) return false;
            
            await messageOps.clearChatMessages(chatId);
            
            for (const msg of messages) {
                await messageOps.addMessage(
                    chatId,
                    msg.sender || 'user',
                    msg.content || '',
                    msg.attachment || null,
                    msg.searchData || null
                );
            }
            
            return true;
        } catch (error) {
            console.error('Update conversation error:', error);
            return false;
        }
    },
    
    async addMessageToChat(chatId, userId, message) {
        try {
            const chat = await this.getChat(chatId, userId);
            if (!chat) return false;
            
            const result = await messageOps.addMessage(
                chatId,
                message.sender,
                message.content,
                message.attachment || null,
                message.searchData || null
            );
            
            return result.success;
        } catch (error) {
            console.error('Add message to chat error:', error);
            return false;
        }
    },
    
    async clearChatMessages(chatId, userId) {
        try {
            const chat = await this.getChat(chatId, userId);
            if (!chat) return false;
            
            return await messageOps.clearChatMessages(chatId);
        } catch (error) {
            console.error('Clear chat messages error:', error);
            return false;
        }
    },
    
    async countUserChats(userId) {
        try {
            const result = await executeD1Query(
                'SELECT COUNT(*) as count FROM chats WHERE user_id = ?',
                [userId]
            );
            
            if (result.success && result.result?.results?.length > 0) {
                return result.result.results[0].count || 0;
            }
            return 0;
        } catch (error) {
            console.error('Count user chats error:', error);
            return 0;
        }
    },
    
    async deleteChat(chatId, userId) {
        try {
            const result = await executeD1Query(
                'DELETE FROM chats WHERE id = ? AND user_id = ?',
                [chatId, userId]
            );
            
            return result.success && result.meta.changes > 0;
        } catch (error) {
            console.error('Delete chat error:', error);
            return false;
        }
    }
};

export const suspensionOps = {
    async suspendUser(userId, reason = null) {
        try {
            const deleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            const result = await executeD1Query(
                'INSERT INTO suspensions (user_id, reason, delete_at) VALUES (?, ?, ?)',
                [userId, reason, deleteAt.toISOString()]
            );
            
            if (result.success) {
                return { success: true, suspensionId: result.meta.last_row_id };
            }
            
            if (result.error?.includes('UNIQUE')) {
                return { success: false, error: 'User already suspended' };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            console.error('Suspend user error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async unsuspendUser(userId) {
        try {
            const result = await executeD1Query(
                'DELETE FROM suspensions WHERE user_id = ?',
                [userId]
            );
            
            return result.success && result.meta.changes > 0;
        } catch (error) {
            console.error('Unsuspend user error:', error);
            return false;
        }
    },
    
    async checkSuspension(userId) {
        try {
            const result = await executeD1Query(
                'SELECT * FROM suspensions WHERE user_id = ?',
                [userId]
            );
            
            if (result.success && result.result?.results?.length > 0) {
                return result.result.results[0];
            }
            return null;
        } catch (error) {
            console.error('Check suspension error:', error);
            return null;
        }
    },
    
    async getExpiredSuspensions() {
        try {
            const result = await executeD1Query(
                `SELECT * FROM suspensions WHERE delete_at <= datetime('now')`
            );
            
            if (result.success && result.result?.results) {
                return result.result.results;
            }
            return [];
        } catch (error) {
            console.error('Get expired suspensions error:', error);
            return [];
        }
    },
    
    async processExpiredSuspensions() {
        try {
            const expired = await this.getExpiredSuspensions();
            
            for (const suspension of expired) {
                await executeD1Query(
                    'DELETE FROM users WHERE id = ?',
                    [suspension.user_id]
                );
            }
            
            return { success: true, processed: expired.length };
        } catch (error) {
            console.error('Process expired suspensions error:', error);
            return { success: false, error: error.message };
        }
    }
};

initDatabase();

setInterval(() => {
    sessionOps.cleanExpiredSessions()
        .then(result => {
            if (result.success && result.deleted > 0) {
            }
        })
        .catch(error => {
            console.error('Session cleanup error:', error);
        });
}, 60 * 60 * 1000);

setInterval(() => {
    suspensionOps.processExpiredSuspensions()
        .then(result => {
            if (result.success && result.processed > 0) {
                console.log(`🔨 Auto-deleted ${result.processed} suspended users`);
            }
        })
        .catch(error => {
            console.error('Auto-delete suspended users error:', error);
        });
}, 5 * 60 * 1000);

export default executeD1Query;