import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import executeD1Query, { userOps, sessionOps, chatOps, suspensionOps, messageOps } from './database.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_PASSWORD = 'TuanHai45191';
const adminSessions = new Map();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generateAdminToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

function csrfProtection(req, res, next) {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        const csrfToken = req.headers['x-csrf-token'];
        const sessionCsrf = req.session?.csrf_token;
        
        if (!csrfToken || !sessionCsrf || csrfToken !== sessionCsrf) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
        }
    }
    next();
}

async function authMiddleware(req, res, next) {
    const authToken = req.cookies.auth_token;
    
    if (!authToken) {
        req.user = null;
        return next();
    }
    
    const session = await sessionOps.findSession(authToken);
    if (!session) {
        res.clearCookie('auth_token');
        res.clearCookie('csrf_token');
        req.user = null;
        return next();
    }
    
    const user = await userOps.getUserById(session.user_id);
    req.user = user;
    req.session = session;
    next();
}

async function suspensionCheckMiddleware(req, res, next) {
    if (!req.user) return next();
    
    const suspension = await suspensionOps.checkSuspension(req.user.id);
    if (suspension) {
        req.suspension = suspension;
    }
    next();
}

async function blockSuspendedAPI(req, res, next) {
    const allowedAPIs = [
        '/api/suspension',
        '/api/logout', 
        '/api/status',
        '/api/csrf'
    ];
    
    if (allowedAPIs.some(api => req.path === api)) {
        return next();
    }
    
    if (req.user && req.path.startsWith('/api/')) {
        const suspension = await suspensionOps.checkSuspension(req.user.id);
        if (suspension) {
            return res.status(403).json({
                error: 'Your account has been suspended',
                suspended: true,
                reason: suspension.reason,
                suspended_at: suspension.suspended_at,
                delete_at: suspension.delete_at
            });
        }
    }
    
    next();
}

function adminAuthMiddleware(req, res, next) {
    const adminToken = req.cookies.admin_token;
    
    if (!adminToken) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    const adminSession = adminSessions.get(adminToken);
    
    if (!adminSession) {
        res.clearCookie('admin_token');
        return res.status(401).json({ error: 'Invalid admin session' });
    }
    
    const now = Date.now();
    if (now > adminSession.expiresAt) {
        adminSessions.delete(adminToken);
        res.clearCookie('admin_token');
        return res.status(401).json({ error: 'Admin session expired' });
    }
    
    req.isAdmin = true;
    next();
}

function serveHTML(res, htmlPath) {
    const minPath = htmlPath.replace('.html', '.min.html');
    const finalPath = fs.existsSync(minPath) ? minPath : htmlPath;
    
    if (!fs.existsSync(finalPath)) {
        return res.status(404).send('Page not found');
    }
    
    const htmlContent = fs.readFileSync(finalPath, 'utf8');
    res.type('text/html').send(htmlContent);
}

router.use(authMiddleware);
router.use(suspensionCheckMiddleware);
router.use(blockSuspendedAPI);

router.use(express.static(path.join(__dirname, '..', 'frontend')));
router.use(express.static(path.join(__dirname, '..')));

router.get('/', async (req, res) => {
    if (req.user) {
        const suspension = await suspensionOps.checkSuspension(req.user.id);
        if (suspension) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            
            return serveHTML(res, path.join(__dirname, '..', 'frontend', 'suspend.html'));
        }
    }
    
    serveHTML(res, path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

router.get('/dashboard', async (req, res) => {
    if (req.user) {
        const suspension = await suspensionOps.checkSuspension(req.user.id);
        if (suspension) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            
            return serveHTML(res, path.join(__dirname, '..', 'frontend', 'suspend.html'));
        }
    }
    
    serveHTML(res, path.join(__dirname, '..', 'frontend', 'chat.html'));
});

router.get('/auth', (req, res) => {
    serveHTML(res, path.join(__dirname, '..', 'frontend', 'auth.html'));
});

router.get('/profile', async (req, res) => {
    if (req.user) {
        const suspension = await suspensionOps.checkSuspension(req.user.id);
        if (suspension) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            
            return serveHTML(res, path.join(__dirname, '..', 'frontend', 'suspend.html'));
        }
    }
    
    serveHTML(res, path.join(__dirname, '..', 'frontend', 'profile.html'));
});

router.get('/admin', (req, res) => {
    serveHTML(res, path.join(__dirname, '..', 'frontend', 'admin.html'));
});

router.get('/suspend', (req, res) => {
    serveHTML(res, path.join(__dirname, '..', 'frontend', 'suspend.html'));
});

router.get('/api/status', (req, res) => {
    res.json({
        status: 'active',
        message: 'TMGPT API is running',
        user: req.user ? { 
            username: req.user.username,
            id: req.user.id 
        } : null,
        suspended: req.suspension ? true : false,
        timestamp: new Date().toISOString()
    });
});

router.get('/api/csrf', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({ csrf_token: req.session.csrf_token });
});

router.get('/api/suspension', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const suspension = await suspensionOps.checkSuspension(req.user.id);
    
    if (suspension) {
        res.json({
            suspended: true,
            reason: suspension.reason,
            suspended_at: suspension.suspended_at,
            delete_at: suspension.delete_at
        });
    } else {
        res.json({ suspended: false });
    }
});

router.post('/api/register', async (req, res) => {
    try {
        const { username, password, repassword } = req.body;
        
        if (!username || !password || !repassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (password !== repassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        const result = await userOps.createUser(username, password);
        
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        
        res.json({ success: true, message: 'User registered successfully' });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const user = await userOps.findUser(username);
        
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const suspension = await suspensionOps.checkSuspension(user.id);
        if (suspension) {
            return res.status(403).json({ 
                error: 'Your account has been suspended',
                suspended: true,
                reason: suspension.reason
            });
        }
        
        const authToken = generateToken();
        const csrfToken = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        const sessionCreated = await sessionOps.createSession(user.id, authToken, csrfToken, expiresAt);
        
        if (!sessionCreated) {
            return res.status(500).json({ error: 'Failed to create session' });
        }
        
        res.cookie('auth_token', authToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
        res.cookie('csrf_token', csrfToken, {
            httpOnly: false,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
        res.json({
            success: true,
            message: 'Login successful',
            user: { 
                username: user.username,
                id: user.id 
            },
            csrf_token: csrfToken
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/logout', csrfProtection, async (req, res) => {
    try {
        const authToken = req.cookies.auth_token;
        
        if (authToken) {
            await sessionOps.deleteSession(authToken);
        }
        
        res.clearCookie('auth_token');
        res.clearCookie('csrf_token');
        
        res.json({ success: true, message: 'Logout successful' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/profile', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            created_at: req.user.created_at,
            avatar: req.user.avatar || null
        }
    });
});

router.put('/api/profile/avatar', csrfProtection, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { avatar } = req.body;
        
        if (!avatar) {
            return res.status(400).json({ error: 'Avatar data is required' });
        }
        
        const isColorAvatar = avatar.startsWith('color:');
        const isImageAvatar = avatar.startsWith('data:image');
        
        if (!isColorAvatar && !isImageAvatar) {
            return res.status(400).json({ error: 'Invalid avatar format' });
        }
        
        if (isImageAvatar && avatar.length > 7 * 1024 * 1024) {
            return res.status(400).json({ error: 'Avatar image too large' });
        }
        
        const result = await userOps.updateAvatar(req.user.id, avatar);
        
        if (!result.success) {
            return res.status(500).json({ error: 'Failed to update avatar' });
        }
        
        const updatedUser = await userOps.getUserById(req.user.id);
        
        res.json({ 
            success: true, 
            message: 'Avatar updated successfully',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                created_at: updatedUser.created_at,
                avatar: updatedUser.avatar
            }
        });
        
    } catch (error) {
        console.error('Update avatar error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/api/profile/password', csrfProtection, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        const result = await executeD1Query(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (!result.success || !result.result?.results?.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.result.results[0];
        
        if (currentPassword !== user.password) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const updateResult = await userOps.updatePassword(req.user.id, newPassword);
        
        if (!updateResult.success) {
            return res.status(500).json({ error: 'Failed to update password' });
        }
        
        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/api/profile', csrfProtection, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        
        const result = await executeD1Query(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (!result.success || !result.result?.results?.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.result.results[0];
        
        if (password !== user.password) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        await sessionOps.deleteUserSessions(req.user.id);
        
        const deleteResult = await executeD1Query(
            'DELETE FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (!deleteResult.success) {
            return res.status(500).json({ error: 'Failed to delete account' });
        }
        
        res.clearCookie('auth_token');
        res.clearCookie('csrf_token');
        
        res.json({ 
            success: true, 
            message: 'Account deleted successfully' 
        });
        
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/chats', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const chats = await chatOps.getUserChats(req.user.id);
        
        res.json({ 
            success: true,
            chats: chats 
        });
        
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Failed to load chats' });
    }
});

router.post('/api/chats', csrfProtection, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { name } = req.body;
        
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Chat name is required' });
        }
        
        if (name.length > 100) {
            return res.status(400).json({ error: 'Chat name is too long (max 100 characters)' });
        }
        
        const chatCount = await chatOps.countUserChats(req.user.id);
        if (chatCount >= 10) {
            return res.status(400).json({ 
                error: 'You have reached the maximum limit of 10 chats',
                code: 'MAX_CHATS_REACHED'
            });
        }
        
        const result = await chatOps.createChat(req.user.id, name.trim());
        
        if (!result.success) {
            console.error('Failed to create chat:', result.error);
            return res.status(500).json({ error: 'Failed to create chat' });
        }
        
        const chat = await chatOps.getChat(result.chatId, req.user.id);
        
        if (!chat) {
            console.error('Chat was created but not found:', result.chatId);
            return res.status(500).json({ error: 'Chat created but not found' });
        }
        
        res.json({ 
            success: true,
            message: 'Chat created successfully',
            chat: chat
        });
        
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/chats/:chatId', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const chatId = parseInt(req.params.chatId);
        
        if (isNaN(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        const chat = await chatOps.getChat(chatId, req.user.id);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        res.json({ 
            success: true,
            chat: chat
        });
        
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/chats/:chatId/clear', csrfProtection, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const chatId = parseInt(req.params.chatId);
        
        if (isNaN(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        const success = await chatOps.clearChatMessages(chatId, req.user.id);
        
        if (!success) {
            return res.status(404).json({ error: 'Chat not found or access denied' });
        }
        
        res.json({ 
            success: true,
            message: 'Chat messages cleared successfully' 
        });
        
    } catch (error) {
        console.error('Clear chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/api/chats/:chatId', csrfProtection, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const chatId = parseInt(req.params.chatId);
        
        if (isNaN(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        const success = await chatOps.deleteChat(chatId, req.user.id);
        
        if (!success) {
            return res.status(404).json({ error: 'Chat not found or access denied' });
        }
        
        res.json({ 
            success: true,
            message: 'Chat deleted successfully' 
        });
        
    } catch (error) {
        console.error('Delete chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/api/chats/:chatId/conversation', csrfProtection, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const chatId = parseInt(req.params.chatId);
        const { messages } = req.body;
        
        if (isNaN(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        if (!Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages must be an array' });
        }
        
        const success = await chatOps.updateConversation(chatId, req.user.id, messages);
        
        if (!success) {
            return res.status(404).json({ error: 'Chat not found or access denied' });
        }
        
        res.json({ 
            success: true,
            message: 'Conversation updated successfully' 
        });
        
    } catch (error) {
        console.error('Update conversation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid admin password' });
        }
        
        const adminToken = generateAdminToken();
        const expiresAt = Date.now() + (2 * 60 * 60 * 1000);
        
        adminSessions.set(adminToken, {
            createdAt: Date.now(),
            expiresAt: expiresAt
        });
        
        res.cookie('admin_token', adminToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 2 * 60 * 60 * 1000
        });
        
        res.json({
            success: true,
            message: 'Admin login successful'
        });
        
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/admin/logout', async (req, res) => {
    try {
        const adminToken = req.cookies.admin_token;
        
        if (adminToken) {
            adminSessions.delete(adminToken);
        }
        
        res.clearCookie('admin_token');
        
        res.json({ success: true, message: 'Admin logout successful' });
        
    } catch (error) {
        console.error('Admin logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/admin/verify', async (req, res) => {
    const adminToken = req.cookies.admin_token;
    
    if (!adminToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const adminSession = adminSessions.get(adminToken);
    
    if (!adminSession) {
        res.clearCookie('admin_token');
        return res.status(401).json({ error: 'Invalid admin session' });
    }
    
    if (Date.now() > adminSession.expiresAt) {
        adminSessions.delete(adminToken);
        res.clearCookie('admin_token');
        return res.status(401).json({ error: 'Admin session expired' });
    }
    
    res.json({ 
        success: true,
        authenticated: true 
    });
});

router.get('/api/admin/users', adminAuthMiddleware, async (req, res) => {
    try {
        const result = await executeD1Query(`
            SELECT 
                u.id,
                u.username,
                u.password,
                u.avatar,
                u.created_at,
                u.updated_at,
                COUNT(DISTINCT c.id) as chat_count,
                s.id as suspension_id,
                s.reason as suspension_reason,
                s.suspended_at,
                s.delete_at
            FROM users u
            LEFT JOIN chats c ON u.id = c.user_id
            LEFT JOIN suspensions s ON u.id = s.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        
        if (!result.success || !result.result?.results) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        
        const users = result.result.results;
        
        const usersWithChats = await Promise.all(users.map(async (user) => {
            const chats = await chatOps.getUserChats(user.id);
            return {
                ...user,
                chats: chats,
                is_suspended: !!user.suspension_id,
                suspension: user.suspension_id ? {
                    reason: user.suspension_reason,
                    suspended_at: user.suspended_at,
                    delete_at: user.delete_at
                } : null
            };
        }));
        
        res.json({
            success: true,
            users: usersWithChats
        });
        
    } catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/admin/users/:userId/suspend', adminAuthMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { reason } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const result = await suspensionOps.suspendUser(userId, reason || null);
        
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        
        res.json({
            success: true,
            message: 'User suspended successfully'
        });
        
    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/admin/users/:userId/unsuspend', adminAuthMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const success = await suspensionOps.unsuspendUser(userId);
        
        if (!success) {
            return res.status(404).json({ error: 'User not suspended' });
        }
        
        res.json({
            success: true,
            message: 'User unsuspended successfully'
        });
        
    } catch (error) {
        console.error('Unsuspend user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/api/admin/users/:userId', adminAuthMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const result = await executeD1Query(
            'DELETE FROM users WHERE id = ?',
            [userId]
        );
        
        if (!result.success || result.meta.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

setInterval(() => {
    const now = Date.now();
    for (const [token, session] of adminSessions.entries()) {
        if (now > session.expiresAt) {
            adminSessions.delete(token);
        }
    }
}, 10 * 60 * 1000);

export default router;