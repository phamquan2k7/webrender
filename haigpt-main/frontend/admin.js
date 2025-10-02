const { useState, useEffect, useRef, useCallback } = React;

// Utility functions
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds} giây trước`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} ngày trước`;
    return formatDate(dateString);
};

// Get avatar color
const getAvatarColor = (index) => {
    const colors = [
        '#ff0080', '#ff8c00', '#40e0d0', '#0080ff', 
        '#8000ff', '#32cd32', '#ff6347', '#9370db', 
        '#20b2aa', '#ffa500', '#dc143c', '#00ced1'
    ];
    return colors[index % colors.length];
};

// Parse markdown to HTML (basic version)
const parseBasicMarkdown = (text) => {
    if (!text) return '';
    
    let html = text;
    
    // Escape HTML
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        return `<pre><code class="language-${language}">${code.trim()}</code></pre>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
};

// User Avatar Component
const UserAvatar = ({ user, size = 50 }) => {
    if (user.avatar) {
        if (user.avatar.startsWith('data:image')) {
            return (
                <div 
                    className="user-avatar" 
                    style={{ 
                        width: size,
                        height: size,
                        backgroundImage: `url(${user.avatar})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
            );
        } else if (user.avatar.startsWith('color:')) {
            const colorIndex = parseInt(user.avatar.split(':')[1]);
            return (
                <div 
                    className="user-avatar" 
                    style={{ 
                        width: size,
                        height: size,
                        background: getAvatarColor(colorIndex) 
                    }}
                >
                    {user.username.charAt(0).toUpperCase()}
                </div>
            );
        }
    }
    
    return (
        <div 
            className="user-avatar" 
            style={{ 
                width: size,
                height: size,
                background: getAvatarColor(0) 
            }}
        >
            {user.username.charAt(0).toUpperCase()}
        </div>
    );
};

// Message Component với error boundary
const MessageItem = React.memo(({ message, username }) => {
    const [hasError, setHasError] = useState(false);
    
    useEffect(() => {
        try {
            // Highlight code blocks chỉ cho element này
            const codeBlocks = document.querySelectorAll(`#msg-${message.id || message.timestamp} pre code`);
            if (window.Prism && codeBlocks.length > 0) {
                codeBlocks.forEach(block => {
                    window.Prism.highlightElement(block);
                });
            }
        } catch (error) {
            console.error('Prism highlight error:', error);
        }
    }, [message.id, message.timestamp]);
    
    if (hasError) {
        return (
            <div className="message-item error">
                <div className="message-content">
                    <p style={{ color: '#dc3545' }}>⚠️ Lỗi hiển thị tin nhắn</p>
                </div>
            </div>
        );
    }
    
    try {
        const isUser = message.sender === 'user';
        const isAssistant = message.sender === 'assistant';
        
        return (
            <div className="message-item" id={`msg-${message.id || message.timestamp}`}>
                <div className={`message-avatar ${message.sender}`}>
                    {isUser ? username?.charAt(0).toUpperCase() : 
                     isAssistant ? 'AI' : '⚠️'}
                </div>
                <div className="message-content">
                    <div className="message-header">
                        <span className={`message-sender ${message.sender}`}>
                            {isUser ? username : isAssistant ? 'HaiGPT' : 'System'}
                        </span>
                        <span className="message-time">
                            {formatDate(message.timestamp)}
                        </span>
                    </div>
                    
                    {message.attachment && (
                        <div className="message-attachment">
                            {message.attachment.type === 'image' ? (
                                <div className="attachment-image">
                                    <img 
                                        src={message.attachment.preview || message.attachment.url} 
                                        alt="Attachment" 
                                        loading="lazy"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = '⚠️ Không thể tải ảnh';
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="attachment-file">
                                    <span className="file-icon">📎</span>
                                    <span className="file-name">File attachment</span>
                                    <span className="file-size">
                                        {message.attachment.size ? `${Math.round(message.attachment.size / 1024)}KB` : ''}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div 
                        className="message-text"
                        dangerouslySetInnerHTML={{ 
                            __html: DOMPurify.sanitize(parseBasicMarkdown(message.content || ''))
                        }}
                    />
                </div>
            </div>
        );
    } catch (error) {
        console.error('Message render error:', error);
        setHasError(true);
        return null;
    }
});

// Messages container với pagination
const MessagesContainer = ({ messages, username, chatName }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [messagesPerPage] = useState(20); // Hiển thị 20 tin nhắn mỗi trang
    const [isLoading, setIsLoading] = useState(false);
    
    // Tính toán messages cho trang hiện tại
    const indexOfLastMessage = currentPage * messagesPerPage;
    const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
    const currentMessages = messages.slice(indexOfFirstMessage, indexOfLastMessage);
    const totalPages = Math.ceil(messages.length / messagesPerPage);
    
    // Reset về trang 1 khi đổi chat
    useEffect(() => {
        setCurrentPage(1);
    }, [chatName]);
    
    const handlePageChange = (pageNumber) => {
        setIsLoading(true);
        setCurrentPage(pageNumber);
        
        // Scroll to top của messages container
        setTimeout(() => {
            const messagesContainer = document.querySelector('.messages-list');
            if (messagesContainer) {
                messagesContainer.scrollTop = 0;
            }
            setIsLoading(false);
        }, 100);
    };
    
    return (
        <>
            <div className="section-title">
                {chatName}
                <span className="chat-count">
                    {messages.length} tin nhắn
                    {totalPages > 1 && ` • Trang ${currentPage}/${totalPages}`}
                </span>
            </div>
            
            {messages.length > 0 ? (
                <>
                    {/* Pagination controls ở trên */}
                    {totalPages > 1 && (
                        <div className="pagination-controls top">
                            <button 
                                className="pagination-btn"
                                onClick={() => handlePageChange(1)}
                                disabled={currentPage === 1}
                            >
                                ⏮ Đầu
                            </button>
                            <button 
                                className="pagination-btn"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                ◀ Trước
                            </button>
                            
                            <div className="pagination-info">
                                Hiển thị {indexOfFirstMessage + 1}-{Math.min(indexOfLastMessage, messages.length)} / {messages.length}
                            </div>
                            
                            <button 
                                className="pagination-btn"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                Sau ▶
                            </button>
                            <button 
                                className="pagination-btn"
                                onClick={() => handlePageChange(totalPages)}
                                disabled={currentPage === totalPages}
                            >
                                Cuối ⏭
                            </button>
                        </div>
                    )}
                    
                    <div className={`messages-list ${isLoading ? 'loading' : ''}`}>
                        {isLoading ? (
                            <div className="messages-loading">
                                <div className="loading-spinner"></div>
                                <p>Đang tải tin nhắn...</p>
                            </div>
                        ) : (
                            currentMessages.map((message, index) => (
                                <MessageItem 
                                    key={message.id || `${message.timestamp}-${index}`}
                                    message={message}
                                    username={username}
                                />
                            ))
                        )}
                    </div>
                    
                    {/* Pagination controls ở dưới */}
                    {totalPages > 1 && !isLoading && (
                        <div className="pagination-controls bottom">
                            {/* Quick jump to page */}
                            <div className="page-jumper">
                                <span>Nhảy đến trang:</span>
                                <select 
                                    value={currentPage} 
                                    onChange={(e) => handlePageChange(Number(e.target.value))}
                                    className="page-select"
                                >
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            Trang {i + 1}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <div className="empty-text">Chưa có tin nhắn</div>
                    <div className="empty-subtext">
                        Cuộc trò chuyện này trống
                    </div>
                </div>
            )}
        </>
    );
};

// Main Admin Panel Component
const AdminPanel = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);
    
    // Admin data states
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedChat, setSelectedChat] = useState(null);
    const [view, setView] = useState('users'); // 'users', 'chats', 'messages'
    
    useEffect(() => {
        checkAdminAuth();
    }, []);
    
    const checkAdminAuth = async () => {
        try {
            const response = await fetch('/api/admin/verify', {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                setIsAuthenticated(true);
                await loadUsers();
            }
        } catch (error) {
            console.error('Auth check error:', error);
        } finally {
            setLoading(false);
            setTimeout(() => setLoaded(true), 100);
        }
    };
    
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        
        // Send password to backend for verification
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password }),
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                setIsAuthenticated(true);
                setPassword(''); // Clear password from memory
                await loadUsers();
            } else {
                setError(data.error || 'Mật khẩu không đúng!');
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('Lỗi kết nối server');
        }
    };
    
    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Đăng xuất Admin?',
            text: 'Bạn chắc chắn muốn đăng xuất?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Đăng xuất',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        });
        
        if (result.isConfirmed) {
            try {
                await fetch('/api/admin/logout', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                
                setIsAuthenticated(false);
                setUsers([]);
                setSelectedUser(null);
                setSelectedChat(null);
                setView('users');
                setPassword('');
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    };
    
    const loadUsers = async () => {
        try {
            const response = await fetch('/api/admin/users', {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            } else if (response.status === 401) {
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Load users error:', error);
        }
    };
    
    const handleSuspendUser = async (user) => {
        const result = await Swal.fire({
            title: `Suspend ${user.username}?`,
            html: `
                <p style="margin-bottom: 15px">User sẽ bị block khỏi dashboard và profile.</p>
                <p style="margin-bottom: 15px; color: #dc3545">Account sẽ tự động bị xóa sau 24 giờ!</p>
                <textarea 
                    id="suspend-reason" 
                    class="swal2-textarea" 
                    placeholder="Nhập lý do suspend (không bắt buộc)..."
                    style="resize: vertical; min-height: 80px;"
                ></textarea>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Suspend',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#ffa500',
            cancelButtonColor: '#6c757d',
            preConfirm: () => {
                return document.getElementById('suspend-reason').value;
            }
        });
        
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/admin/users/${user.id}/suspend`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason: result.value || null }),
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    await Swal.fire({
                        title: 'Suspended!',
                        text: `${user.username} đã bị suspend thành công`,
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    await loadUsers();
                } else {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to suspend user');
                }
            } catch (error) {
                Swal.fire({
                    title: 'Lỗi!',
                    text: error.message,
                    icon: 'error',
                    confirmButtonColor: '#dc3545'
                });
            }
        }
    };
    
    const handleUnsuspendUser = async (user) => {
        const result = await Swal.fire({
            title: `Unsuspend ${user.username}?`,
            text: 'User sẽ được khôi phục quyền truy cập đầy đủ',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Unsuspend',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d'
        });
        
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/admin/users/${user.id}/unsuspend`, {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    await Swal.fire({
                        title: 'Unsuspended!',
                        text: `${user.username} đã được gỡ suspension`,
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    await loadUsers();
                } else {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to unsuspend user');
                }
            } catch (error) {
                Swal.fire({
                    title: 'Lỗi!',
                    text: error.message,
                    icon: 'error',
                    confirmButtonColor: '#dc3545'
                });
            }
        }
    };
    
    const handleDeleteUser = async (user) => {
        const result = await Swal.fire({
            title: `Xóa ${user.username}?`,
            html: `
                <p style="color: #dc3545; font-weight: 600">⚠️ CẢNH BÁO: Hành động này không thể hoàn tác!</p>
                <p>Tất cả dữ liệu của user sẽ bị xóa vĩnh viễn.</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        });
        
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/admin/users/${user.id}`, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    await Swal.fire({
                        title: 'Đã xóa!',
                        text: `${user.username} đã bị xóa khỏi hệ thống`,
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    await loadUsers();
                } else {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to delete user');
                }
            } catch (error) {
                Swal.fire({
                    title: 'Lỗi!',
                    text: error.message,
                    icon: 'error',
                    confirmButtonColor: '#dc3545'
                });
            }
        }
    };
    
    const handleUserClick = (user) => {
        setSelectedUser(user);
        setSelectedChat(null);
        setView('chats');
    };
    
    const handleChatClick = (chat) => {
        setSelectedChat(chat);
        setView('messages');
    };
    
    const handleBackToUsers = () => {
        setSelectedUser(null);
        setSelectedChat(null);
        setView('users');
    };
    
    const handleBackToChats = () => {
        setSelectedChat(null);
        setView('chats');
    };
    
    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Đang tải...</p>
            </div>
        );
    }
    
    if (!isAuthenticated) {
        return (
            <div className="login-container">
                <div className="login-box">
                    <h1 className="login-title">HaiGPT</h1>
                    <p className="login-subtitle">Admin Panel</p>
                    
                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            className="password-input"
                            placeholder="Nhập mật khẩu admin..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                        
                        <button type="submit" className="login-button">
                            Đăng nhập
                        </button>
                        
                        {error && <p className="error-message">{error}</p>}
                    </form>
                </div>
            </div>
        );
    }
    
    return (
        <div className={`admin-container ${loaded ? 'loaded' : ''}`}>
            <div className="admin-header">
                <div className="admin-title-wrapper">
                    <h1 className="admin-title">HaiGPT</h1>
                    <span className="admin-badge">ADMIN</span>
                </div>
                <p className="admin-caption">Admin Panel - Quản lý hệ thống</p>
                
                <button onClick={handleLogout} className="logout-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                </button>
            </div>
            
            <div className="admin-content">
                {/* Breadcrumb Navigation */}
                <div className="breadcrumb">
                    <span 
                        className={view === 'users' ? 'breadcrumb-current' : 'breadcrumb-item'}
                        onClick={handleBackToUsers}
                    >
                        Danh sách người dùng
                    </span>
                    
                    {selectedUser && (
                        <>
                            <span className="breadcrumb-separator">→</span>
                            <span 
                                className={view === 'chats' ? 'breadcrumb-current' : 'breadcrumb-item'}
                                onClick={handleBackToChats}
                            >
                                {selectedUser.username}
                            </span>
                        </>
                    )}
                    
                    {selectedChat && (
                        <>
                            <span className="breadcrumb-separator">→</span>
                            <span className="breadcrumb-current">
                                {selectedChat.name}
                            </span>
                        </>
                    )}
                </div>
                
                {/* Stats Cards (Users View) */}
                {view === 'users' && (
                    <div className="stats-cards">
                        <div className="stat-card">
                            <div className="stat-value">{users.length}</div>
                            <div className="stat-label">Tổng người dùng</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">
                                {users.reduce((sum, user) => sum + (user.chats?.length || 0), 0)}
                            </div>
                            <div className="stat-label">Tổng cuộc trò chuyện</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">
                                {users.reduce((sum, user) => 
                                    sum + user.chats?.reduce((msgSum, chat) => 
                                        msgSum + (chat.messages?.length || 0), 0) || 0, 0)}
                            </div>
                            <div className="stat-label">Tổng tin nhắn</div>
                        </div>
                    </div>
                )}
                
                {/* Users Grid */}
                {view === 'users' && (
                    <div className="users-grid">
                        {users.map(user => (
                            <div 
                                key={user.id} 
                                className="user-card"
                                onClick={() => handleUserClick(user)}
                            >
                                <div className="user-card-header">
                                    <UserAvatar user={user} />
                                    <div className="user-info">
                                        <div className="user-username">
                                            {user.username}
                                            {user.is_suspended && (
                                                <span className="suspension-badge">SUSPENDED</span>
                                            )}
                                        </div>
                                        <div className="user-id">ID: {user.id}</div>
                                    </div>
                                </div>
                                
                                <div className="user-details">
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Mật khẩu:</span>
                                        <span className="user-detail-value user-password">
                                            {user.password}
                                        </span>
                                    </div>
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Ngày tạo:</span>
                                        <span className="user-detail-value">
                                            {formatDate(user.created_at)}
                                        </span>
                                    </div>
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Số chat:</span>
                                        <span className="user-detail-value">
                                            {user.chat_count || 0}
                                        </span>
                                    </div>
                                    
                                    {user.is_suspended && user.suspension && (
                                        <div className="suspension-info">
                                            <div className="suspension-reason">
                                                <strong>Lý do:</strong> {user.suspension.reason || 'Không có'}
                                            </div>
                                            <div className="suspension-time">
                                                <strong>Tự động xóa:</strong> {formatTimeAgo(user.suspension.delete_at)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="user-actions" onClick={(e) => e.stopPropagation()}>
                                    {user.is_suspended ? (
                                        <button 
                                            className="action-btn unsuspend-btn"
                                            onClick={() => handleUnsuspendUser(user)}
                                            title="Gỡ suspension"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Unsuspend
                                        </button>
                                    ) : (
                                        <button 
                                            className="action-btn suspend-btn"
                                            onClick={() => handleSuspendUser(user)}
                                            title="Suspend user"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                            </svg>
                                            Suspend
                                        </button>
                                    )}
                                    
                                    <button 
                                        className="action-btn delete-btn"
                                        onClick={() => handleDeleteUser(user)}
                                        title="Xóa user"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Xóa
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Chats List */}
                {view === 'chats' && selectedUser && (
                    <div className="chats-container">
                        <div className="section-title">
                            Cuộc trò chuyện của {selectedUser.username}
                            <span className="chat-count">{selectedUser.chats?.length || 0}</span>
                        </div>
                        
                        {selectedUser.chats && selectedUser.chats.length > 0 ? (
                            <div className="chats-list">
                                {selectedUser.chats.map(chat => (
                                    <div 
                                        key={chat.id}
                                        className="chat-item"
                                        onClick={() => handleChatClick(chat)}
                                    >
                                        <div className="chat-info">
                                            <div className="chat-name">{chat.name}</div>
                                            <div className="chat-meta">
                                                <span className="chat-messages-count">
                                                    💬 {chat.message_count || 0} tin nhắn
                                                </span>
                                                <span className="chat-updated">
                                                    🕐 {formatTimeAgo(chat.updated_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="chat-arrow">→</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">💬</div>
                                <div className="empty-text">Chưa có cuộc trò chuyện nào</div>
                                <div className="empty-subtext">
                                    Người dùng này chưa tạo chat
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Messages View với Pagination */}
                {view === 'messages' && selectedChat && selectedUser && (
                    <div className="messages-container">
                        <MessagesContainer 
                            messages={selectedChat.messages || []}
                            username={selectedUser.username}
                            chatName={selectedChat.name}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// Render app
ReactDOM.render(<AdminPanel />, document.getElementById('root'));