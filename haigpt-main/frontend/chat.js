const parseMarkdownWithCodeBlocks = (text, isStreaming = false) => {
    if (!text) return [];
    
    const parts = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const incompleteCodeBlockRegex = /```(\w+)?\n([\s\S]*)$/;
    
    let lastIndex = 0;
    let match;
    
    if (isStreaming && text.includes('```') && !text.endsWith('```')) {
        const incompleteMatch = text.match(incompleteCodeBlockRegex);
        if (incompleteMatch) {
            const beforeCodeIndex = text.lastIndexOf('```');
            if (beforeCodeIndex > 0) {
                const textBefore = text.substring(0, beforeCodeIndex);
                if (textBefore.trim()) {
                    const completeParts = parseMarkdownWithCodeBlocks(textBefore, false);
                    parts.push(...completeParts);
                }
            }
            
            const language = incompleteMatch[1] || 'plaintext';
            const code = incompleteMatch[2] || '';
            const lines = code.split('\n').filter(line => line !== '').length;
            
            parts.push({
                type: 'code',
                language: language,
                content: code,
                lines: lines,
                isStreaming: true
            });
            
            return parts;
        }
    }
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const textBefore = text.substring(lastIndex, match.index);
            if (textBefore.trim()) {
                parts.push({
                    type: 'text',
                    content: textBefore
                });
            }
        }
        
        const language = match[1] || 'plaintext';
        const code = match[2];
        const lines = code.split('\n').filter(line => line !== '').length;
        
        parts.push({
            type: 'code',
            language: language,
            content: code,
            lines: lines,
            isStreaming: false
        });
        
        lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        if (remainingText.trim()) {
            parts.push({
                type: 'text',
                content: remainingText
            });
        }
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

const parseMarkdownSafe = (text) => {
    if (!text) return '';
    
    let result = text;
    
    result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    result = result.replace(/\n/g, '<br>');
    
    return result;
};

const escapeHTML = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const safeToISOString = (date) => {
    try {
        if (date instanceof Date && !isNaN(date)) {
            return date.toISOString();
        }
        if (typeof date === 'string') {
            const parsed = new Date(date);
            if (!isNaN(parsed)) {
                return parsed.toISOString();
            }
        }
    } catch (e) {
        console.warn('Invalid date:', date);
    }
    return new Date().toISOString();
};

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const LANGUAGE_ICONS = {
    'python': '🐍', 'py': '🐍',
    'javascript': '📜', 'js': '📜', 'jsx': '⚛️',
    'typescript': '📘', 'ts': '📘', 'tsx': '⚛️',
    'html': '🌐', 'markup': '🌐',
    'css': '🎨', 'scss': '🎨', 'sass': '🎨',
    'c': '🔷', 'cpp': '🔷', 'c++': '🔷', 'csharp': '🟦', 'cs': '🟦',
    'java': '☕',
    'php': '🐘',
    'ruby': '💎', 'rb': '💎',
    'go': '🐹',
    'rust': '🦀', 'rs': '🦀',
    'swift': '🦉',
    'kotlin': '🟠', 'kt': '🟠',
    'sql': '🗃️',
    'bash': '💻', 'shell': '💻', 'sh': '💻',
    'json': '📊',
    'yaml': '📑', 'yml': '📑',
    'markdown': '📝', 'md': '📝',
    'plaintext': '📄', 'text': '📄'
};

const FILE_ICONS = {
    'py': '🐍', 'js': '📜', 'jsx': '⚛️', 'ts': '📘', 'tsx': '⚛️',
    'html': '🌐', 'css': '🎨', 'scss': '🎨',
    'c': '🔷', 'cpp': '🔷', 'cs': '🟦',
    'java': '☕', 'php': '🐘', 'rb': '💎',
    'go': '🐹', 'rs': '🦀', 'swift': '🦉', 'kt': '🟠',
    'txt': '📄', 'md': '📝', 'json': '📊', 'xml': '📋',
    'yaml': '📑', 'yml': '📑', 'sql': '🗃️',
    'sh': '💻', 'bash': '💻', 'bat': '🖥️',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
    'svg': '🎨', 'webp': '🖼️',
    'default': '📎'
};

const CODE_EXTENSIONS = [
    'py', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'sass',
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'cs', 'java', 'php', 'rb', 'go',
    'rs', 'swift', 'kt', 'json', 'xml', 'yaml', 'yml', 'sql', 'sh', 'bash',
    'zsh', 'bat', 'cmd', 'ps1', 'md', 'txt', 'log', 'ini', 'conf', 'config'
];

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || FILE_ICONS['default'];
};

const getLanguageFromExt = (ext) => {
    const langMap = {
        'py': 'Python', 'js': 'JavaScript', 'jsx': 'React',
        'ts': 'TypeScript', 'tsx': 'React TS',
        'html': 'HTML', 'htm': 'HTML', 'css': 'CSS',
        'c': 'C', 'cpp': 'C++', 'cc': 'C++', 'cs': 'C#',
        'java': 'Java', 'php': 'PHP', 'rb': 'Ruby',
        'go': 'Go', 'rs': 'Rust', 'swift': 'Swift',
        'kt': 'Kotlin', 'json': 'JSON', 'xml': 'XML',
        'yaml': 'YAML', 'yml': 'YAML', 'sql': 'SQL',
        'sh': 'Shell', 'md': 'Markdown', 'txt': 'Text'
    };
    return langMap[ext] || 'Code';
};

const getAvatarColor = (index) => {
    const colors = [
        '#ff0080', '#ff8c00', '#40e0d0', '#0080ff', 
        '#8000ff', '#32cd32', '#ff6347', '#9370db', 
        '#20b2aa', '#ffa500', '#dc143c', '#00ced1'
    ];
    return colors[index % colors.length];
};

const SearchDropdown = ({ searchData, isExpanded, onToggle }) => {
    const [expanded, setExpanded] = useState(isExpanded);
    
    useEffect(() => {
        setExpanded(isExpanded);
    }, [isExpanded]);
    
    const handleToggle = () => {
        const newState = !expanded;
        setExpanded(newState);
        if (onToggle) onToggle(newState);
    };
    
    const getFaviconUrl = (url) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
            return null;
        }
    };
    
    return (
        <div className="search-dropdown-container">
            <div 
                className={`search-dropdown-header ${searchData.status === 'complete' ? 'complete' : ''}`}
                onClick={handleToggle}
            >
                <div className="search-header-left">
                    {searchData.status === 'searching' ? (
                        <div className="search-spinner">
                            <svg width="20" height="20" viewBox="0 0 24 24" className="spinning">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.415 31.415" transform="rotate(-90 12 12)"/>
                            </svg>
                        </div>
                    ) : (
                        <div className="search-icon-complete">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                                <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
                                {searchData.status === 'complete' && (
                                    <path d="M9 11l2 2 4-4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                )}
                            </svg>
                        </div>
                    )}
                    <span className="search-header-text">
                        {searchData.status === 'searching' ? 'Đang tìm kiếm' : 'Kết quả tìm kiếm'}
                        {searchData.query && <span className="search-query">"{searchData.query}"</span>}
                    </span>
                </div>
                <div className="search-header-right">
                    {searchData.results && searchData.results.length > 0 && (
                        <span className="search-count">{searchData.results.length} kết quả</span>
                    )}
                    <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor"
                        className={`expand-icon ${expanded ? 'expanded' : ''}`}
                    >
                        <polyline points="6 9 12 15 18 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
            
            {expanded && searchData.results && searchData.results.length > 0 && (
                <div className="search-results-list">
                    {searchData.results.map((result, index) => (
                        <a 
                            key={index} 
                            href={result.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="search-result-item"
                        >
                            <div className="result-favicon">
                                {getFaviconUrl(result.link) ? (
                                    <img 
                                        src={getFaviconUrl(result.link)} 
                                        alt="" 
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div className="favicon-fallback" style={{display: getFaviconUrl(result.link) ? 'none' : 'flex'}}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth="1.5"/>
                                    </svg>
                                </div>
                            </div>
                            <div className="result-content">
                                <div className="result-title">{result.title}</div>
                                <div className="result-url">{result.displayLink}</div>
                                {result.snippet && (
                                    <div className="result-snippet">{result.snippet}</div>
                                )}
                            </div>
                            {result.hasScreenshot && (
                                <div className="result-screenshot-badge">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5"/>
                                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                                        <polyline points="21 15 16 10 5 21" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                            )}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

const CodeBlock = ({ language, code, lines, isStreaming, messageId, forceCollapsed = false }) => {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef(null);
    
    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }, [code]);
    
    useEffect(() => {
        if (codeRef.current && window.Prism && !isStreaming) {
            try {
                const supportedLang = window.Prism.languages[language] ? language : 'plaintext';
                codeRef.current.className = `language-${supportedLang}`;
                window.Prism.highlightElement(codeRef.current);
            } catch (error) {
                console.warn('Prism highlighting error:', error);
            }
        }
    }, [code, language, isStreaming]);
    
    const languageIcon = LANGUAGE_ICONS[language.toLowerCase()] || '📄';
    const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);
    
    if (isStreaming || forceCollapsed || lines >= 100) {
        return (
            <CollapsedCodeBlock
                language={language}
                code={code}
                lines={lines}
                isStreaming={isStreaming}
                messageId={messageId}
            />
        );
    } else {
        return (
            <div className="code-block-inline">
                <div className="code-block-header">
                    <span className="code-language">
                        <span className="code-language-icon">{languageIcon}</span>
                        {displayLanguage}
                    </span>
                    <button className={`copy-button ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                        {copied ? (
                            <>
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 2a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H8z" />
                                    <path d="M4 6a2 2 0 012-2v10a2 2 0 01-2-2V6z" />
                                </svg>
                                Copy
                            </>
                        )}
                    </button>
                </div>
                <div className="code-content">
                    <pre className="line-numbers">
                        <code ref={codeRef} className={`language-${language}`}>
                            {code}
                        </code>
                    </pre>
                </div>
            </div>
        );
    }
};

const CollapsedCodeBlock = ({ language, code, lines, isStreaming, messageId }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    const languageIcon = LANGUAGE_ICONS[language.toLowerCase()] || '📄';
    const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);
    
    return (
        <>
            <div 
                className={`code-block-collapsed ${isStreaming ? 'streaming' : ''}`}
                onClick={() => !isStreaming && setSidebarOpen(true)}
            >
                <span className="code-icon-large">{languageIcon}</span>
                <div className="code-info">
                    <span className="code-title">{displayLanguage}</span>
                    <span className={`code-lines ${isStreaming ? 'streaming' : ''}`}>
                        Lines: {lines}
                    </span>
                </div>
                {isStreaming && <div className="code-spinner"></div>}
            </div>
            
            {sidebarOpen && (
                <CodeSidebar
                    language={language}
                    code={code}
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    isStreaming={isStreaming}
                />
            )}
        </>
    );
};

const CodeSidebar = ({ language, code, isOpen, onClose, isStreaming }) => {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef(null);
    
    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }, [code]);
    
    useEffect(() => {
        if (codeRef.current && window.Prism && !isStreaming) {
            try {
                const supportedLang = window.Prism.languages[language] ? language : 'plaintext';
                codeRef.current.className = `language-${supportedLang}`;
                window.Prism.highlightElement(codeRef.current);
            } catch (error) {
                console.warn('Prism highlighting error:', error);
            }
        }
    }, [code, language, isStreaming]);
    
    const languageIcon = LANGUAGE_ICONS[language.toLowerCase()] || '📄';
    const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);
    
    return (
        <>
            <div className={`code-sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`code-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="code-sidebar-header">
                    <div className="code-sidebar-title">
                        <span>{languageIcon}</span>
                        <span>{displayLanguage} Code</span>
                    </div>
                    <div className="code-sidebar-actions">
                        {isStreaming ? (
                            <div className="code-loading">
                                <div className="code-loading-spinner"></div>
                                <span>Loading...</span>
                            </div>
                        ) : (
                            <button className={`sidebar-copy-button ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                                {copied ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                        </svg>
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M8 2a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H8z" />
                                            <path d="M4 6a2 2 0 012-2v10a2 2 0 01-2-2V6z" />
                                        </svg>
                                        Copy Code
                                    </>
                                )}
                            </button>
                        )}
                        <button className="sidebar-close-button" onClick={onClose}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="code-sidebar-content">
                    <pre className="line-numbers">
                        <code ref={codeRef} className={`language-${language}`}>
                            {code}
                        </code>
                    </pre>
                </div>
            </div>
        </>
    );
};

const MessageContent = ({ content, isStreaming, searchData }) => {
    const parts = useMemo(() => {
        if (!content) return [];
        return parseMarkdownWithCodeBlocks(content, isStreaming);
    }, [content, isStreaming]);
    
    if (searchData) {
        return (
            <div className="message-text">
                <SearchDropdown 
                    searchData={searchData} 
                    isExpanded={searchData.status === 'complete'}
                />
                {searchData.status === 'complete' && parts.map((part, index) => {
                    if (part.type === 'code') {
                        return (
                            <CodeBlock
                                key={index}
                                language={part.language}
                                code={part.content}
                                lines={part.lines}
                                isStreaming={part.isStreaming}
                                messageId={`code-${Date.now()}-${index}`}
                            />
                        );
                    } else {
                        return (
                            <span key={index} dangerouslySetInnerHTML={{ 
                                __html: typeof DOMPurify !== 'undefined' 
                                    ? DOMPurify.sanitize(parseMarkdownSafe(part.content))
                                    : parseMarkdownSafe(part.content)
                            }} />
                        );
                    }
                })}
                {isStreaming && !parts.some(p => p.type === 'code' && p.isStreaming) && searchData.status !== 'searching' && <span className="cursor">|</span>}
            </div>
        );
    }
    
    return (
        <div className="message-text">
            {parts.map((part, index) => {
                if (part.type === 'code') {
                    return (
                        <CodeBlock
                            key={index}
                            language={part.language}
                            code={part.content}
                            lines={part.lines}
                            isStreaming={part.isStreaming}
                            messageId={`code-${Date.now()}-${index}`}
                        />
                    );
                } else {
                    return (
                        <span key={index} dangerouslySetInnerHTML={{ 
                            __html: typeof DOMPurify !== 'undefined' 
                                ? DOMPurify.sanitize(parseMarkdownSafe(part.content))
                                : parseMarkdownSafe(part.content)
                        }} />
                    );
                }
            })}
            {isStreaming && !parts.some(p => p.type === 'code' && p.isStreaming) && <span className="cursor">|</span>}
        </div>
    );
};

const ChatApp = () => {
    const [user, setUser] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [fileContent, setFileContent] = useState(null);
    const [userAvatar, setUserAvatar] = useState(null);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [activeSearches, setActiveSearches] = useState({});
    
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
    const [chatsLoaded, setChatsLoaded] = useState(false);
    
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const messagesAreaRef = useRef(null);
    const inputRef = useRef(null);
    const userMenuRef = useRef(null);
    const fileInputRef = useRef(null);
    
    useEffect(() => {
        checkAuthStatus();
        
        return () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
        };
    }, []);
    
    useEffect(() => {
        if (user && !authChecking) {
            connectWebSocket();
            loadUserProfile();
            loadAllChats();
        }
    }, [user, authChecking]);
    
    useEffect(() => {
        if (isNearBottom) {
            scrollToBottom();
        }
    }, [messages]);
    
    useEffect(() => {
        if (activeChat) {
            loadChatMessages(activeChat);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'set_active_chat',
                    chatId: activeChat.id
                }));
            }
        } else {
            setMessages([]);
        }
    }, [activeChat]);
    
    const checkAuthStatus = async () => {
        try {
            setAuthChecking(true);
            
            const response = await fetch('/api/status', {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                window.location.href = '/auth';
                return;
            }
            
            const data = await response.json();
            
            if (data.user) {
                setUser(data.user);
                setTimeout(() => setLoaded(true), 100);
            } else {
                window.location.href = '/auth';
            }
        } catch (error) {
            window.location.href = '/auth';
        } finally {
            setAuthChecking(false);
        }
    };
    
    const loadUserProfile = async () => {
        try {
            const response = await fetch('/api/profile', {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.user && data.user.avatar) {
                    setUserAvatar(data.user.avatar);
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    };
    
    const loadAllChats = async () => {
        try {
            const response = await fetch('/api/chats', {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.chats) {
                    setChats(data.chats);
                    
                    if (data.chats.length > 0) {
                        setActiveChat(data.chats[0]);
                    }
                    
                    setChatsLoaded(true);
                }
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            Swal.fire({
                title: 'Lỗi',
                text: 'Không thể tải danh sách chat',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080',
                customClass: {
                    popup: 'custom-swal-popup',
                    title: 'custom-swal-title',
                    confirmButton: 'custom-swal-confirm'
                }
            });
        }
    };
    
    const loadChatMessages = (chat) => {
        if (chat && chat.messages) {
            try {
                const formattedMessages = chat.messages.map(msg => {
                    const message = {
                        id: msg.id || generateUniqueId(),
                        sender: msg.sender,
                        content: msg.content,
                        timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
                        attachment: msg.attachment || null,
                        searchData: msg.searchData || null
                    };
                    
                    if (message.searchData && message.sender === 'assistant') {
                        message.searchData = {
                            ...message.searchData,
                            status: 'complete'
                        };
                    }
                    
                    return message;
                });
                setMessages(formattedMessages);
                setIsNearBottom(true);
            } catch (error) {
                console.error('Error formatting messages:', error);
                setMessages([]);
            }
        }
    };
    
    const createNewChat = async () => {
        if (chats.length >= 10) {
            Swal.fire({
                title: 'Đã đạt giới hạn!',
                text: 'Bạn đã có 10 cuộc trò chuyện. Vui lòng xóa bớt để tạo mới.',
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080',
                customClass: {
                    popup: 'custom-swal-popup',
                    title: 'custom-swal-title',
                    confirmButton: 'custom-swal-confirm'
                }
            });
            return;
        }
        
        const result = await Swal.fire({
            title: 'Tạo cuộc trò chuyện mới',
            input: 'text',
            inputLabel: 'Tên cuộc trò chuyện',
            inputPlaceholder: 'Nhập tên cho cuộc trò chuyện...',
            showCancelButton: true,
            confirmButtonText: 'Tạo',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#ff0080',
            cancelButtonColor: '#6c757d',
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title',
                confirmButton: 'custom-swal-confirm',
                cancelButton: 'custom-swal-cancel'
            },
            inputValidator: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Vui lòng nhập tên!';
                }
                if (value.length > 100) {
                    return 'Tên quá dài (tối đa 100 ký tự)';
                }
            }
        });
        
        if (result.isConfirmed) {
            try {
                const csrfResponse = await fetch('/api/csrf');
                const csrfData = await csrfResponse.json();
                
                const response = await fetch('/api/chats', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfData.csrf_token
                    },
                    body: JSON.stringify({ name: result.value }),
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    const newChats = [data.chat, ...chats];
                    setChats(newChats);
                    setActiveChat(data.chat);
                    setChatSidebarOpen(false);
                    
                    Swal.fire({
                        title: 'Thành công!',
                        text: 'Đã tạo cuộc trò chuyện mới',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        customClass: {
                            popup: 'custom-swal-popup',
                            title: 'custom-swal-title'
                        }
                    });
                } else {
                    throw new Error(data.error || 'Failed to create chat');
                }
            } catch (error) {
                console.error('Create chat error:', error);
                Swal.fire({
                    title: 'Lỗi!',
                    text: error.message || 'Không thể tạo cuộc trò chuyện',
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#ff0080',
                    customClass: {
                        popup: 'custom-swal-popup',
                        title: 'custom-swal-title',
                        confirmButton: 'custom-swal-confirm'
                    }
                });
            }
        }
    };
    
    const clearCurrentChat = async () => {
        if (!activeChat) return;
        
        const result = await Swal.fire({
            title: 'Xóa nội dung chat?',
            text: 'Tất cả tin nhắn trong cuộc trò chuyện này sẽ bị xóa!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title',
                confirmButton: 'custom-swal-confirm',
                cancelButton: 'custom-swal-cancel'
            }
        });
        
        if (result.isConfirmed) {
            try {
                const csrfResponse = await fetch('/api/csrf');
                const csrfData = await csrfResponse.json();
                
                const response = await fetch(`/api/chats/${activeChat.id}/clear`, {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': csrfData.csrf_token
                    },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    setMessages([]);
                    const updatedChats = chats.map(chat => 
                        chat.id === activeChat.id 
                            ? { ...chat, messages: [], message_count: 0 }
                            : chat
                    );
                    setChats(updatedChats);
                    
                    Swal.fire({
                        title: 'Đã xóa!',
                        text: 'Nội dung chat đã được xóa',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        customClass: {
                            popup: 'custom-swal-popup',
                            title: 'custom-swal-title'
                        }
                    });
                } else {
                    throw new Error('Failed to clear chat');
                }
            } catch (error) {
                console.error('Clear chat error:', error);
                Swal.fire({
                    title: 'Lỗi!',
                    text: 'Không thể xóa nội dung chat',
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#ff0080',
                    customClass: {
                        popup: 'custom-swal-popup',
                        title: 'custom-swal-title',
                        confirmButton: 'custom-swal-confirm'
                    }
                });
            }
        }
    };
    
    const deleteChat = async (chatId, chatName) => {
        const safeChatName = escapeHTML(chatName);
        
        const result = await Swal.fire({
            title: 'Xóa cuộc trò chuyện?',
            html: `Bạn chắc chắn muốn xóa <strong>"${safeChatName}"</strong>?<br>Hành động này không thể hoàn tác!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title',
                confirmButton: 'custom-swal-confirm',
                cancelButton: 'custom-swal-cancel'
            }
        });
        
        if (result.isConfirmed) {
            try {
                const csrfResponse = await fetch('/api/csrf');
                const csrfData = await csrfResponse.json();
                
                const response = await fetch(`/api/chats/${chatId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-Token': csrfData.csrf_token
                    },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const updatedChats = chats.filter(chat => chat.id !== chatId);
                    setChats(updatedChats);
                    
                    if (activeChat && activeChat.id === chatId) {
                        setActiveChat(updatedChats.length > 0 ? updatedChats[0] : null);
                    }
                    
                    Swal.fire({
                        title: 'Đã xóa!',
                        text: 'Cuộc trò chuyện đã được xóa',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        customClass: {
                            popup: 'custom-swal-popup',
                            title: 'custom-swal-title'
                        }
                    });
                } else {
                    throw new Error('Failed to delete chat');
                }
            } catch (error) {
                console.error('Delete chat error:', error);
                Swal.fire({
                    title: 'Lỗi!',
                    text: 'Không thể xóa cuộc trò chuyện',
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#ff0080',
                    customClass: {
                        popup: 'custom-swal-popup',
                        title: 'custom-swal-title',
                        confirmButton: 'custom-swal-confirm'
                    }
                });
            }
        }
    };
    
    const renderUserAvatar = (small = false) => {
        const className = small ? "user-avatar-small" : "user-avatar";
        
        if (userAvatar) {
            if (userAvatar.startsWith('data:image')) {
                return (
                    <div className={className} style={{ 
                        backgroundImage: `url(${userAvatar})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}>
                    </div>
                );
            } else if (userAvatar.startsWith('color:')) {
                const colorIndex = parseInt(userAvatar.split(':')[1]);
                return (
                    <div className={className} style={{ background: getAvatarColor(colorIndex) }}>
                        {user && user.username.charAt(0).toUpperCase()}
                    </div>
                );
            }
        }
        
        return (
            <div className={className} style={{ background: getAvatarColor(0) }}>
                {user && user.username.charAt(0).toUpperCase()}
            </div>
        );
    };
    
    const connectWebSocket = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
            setIsConnected(true);
            
            if (activeChat) {
                wsRef.current.send(JSON.stringify({
                    type: 'set_active_chat',
                    chatId: activeChat.id
                }));
            }
        };
        
        wsRef.current.onclose = () => {
            setIsConnected(false);
            setTimeout(connectWebSocket, 3000);
        };
        
        wsRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'search_started') {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    
                    if (lastMessage && lastMessage.sender === 'assistant' && lastMessage.isStreaming) {
                        lastMessage.searchData = {
                            status: 'searching',
                            query: data.query,
                            results: []
                        };
                    } else {
                        setIsTyping(false);
                        newMessages.push({
                            id: generateUniqueId(),
                            sender: 'assistant',
                            content: '',
                            timestamp: new Date(),
                            isStreaming: true,
                            searchData: {
                                status: 'searching',
                                query: data.query,
                                results: []
                            }
                        });
                    }
                    
                    return newMessages;
                });
            } else if (data.type === 'search_results') {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    
                    if (lastMessage && lastMessage.searchData) {
                        lastMessage.searchData = {
                            status: 'complete',
                            query: data.query,
                            results: data.results
                        };
                    }
                    
                    return newMessages;
                });
                
                if (data.chatId && activeChat && activeChat.id === data.chatId) {
                    setTimeout(() => {
                        setMessages(currentMessages => {
                            updateChatCache(data.chatId, currentMessages);
                            return currentMessages;
                        });
                    }, 100);
                }
            } else if (data.type === 'search_complete') {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    
                    if (lastMessage && lastMessage.searchData) {
                        lastMessage.searchData.status = 'complete';
                    }
                    
                    return newMessages;
                });
            } else if (data.type === 'ai_chunk') {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    
                    if (lastMessage && lastMessage.sender === 'assistant' && lastMessage.isStreaming) {
                        lastMessage.content += data.content;
                    } else {
                        setIsTyping(false);
                        newMessages.push({
                            id: generateUniqueId(),
                            sender: 'assistant',
                            content: data.content,
                            timestamp: new Date(),
                            isStreaming: true
                        });
                    }
                    
                    return newMessages;
                });
                
                if (data.chatId && activeChat && activeChat.id === data.chatId) {
                    setTimeout(() => {
                        setMessages(currentMessages => {
                            updateChatCache(data.chatId, currentMessages);
                            return currentMessages;
                        });
                    }, 100);
                }
            } else if (data.type === 'ai_complete') {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.isStreaming) {
                        lastMessage.isStreaming = false;
                    }
                    return newMessages;
                });
                setIsTyping(false);
                
                if (data.chatId && activeChat && activeChat.id === data.chatId) {
                    setTimeout(() => {
                        setMessages(currentMessages => {
                            updateChatCache(data.chatId, currentMessages);
                            return currentMessages;
                        });
                    }, 100);
                }
            } else if (data.type === 'ai_thinking') {
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    const isAlreadyStreaming = lastMessage && lastMessage.sender === 'assistant' && lastMessage.isStreaming;
                    
                    if (!isAlreadyStreaming) {
                        setIsTyping(true);
                    }
                    return prev;
                });
            } else if (data.type === 'error') {
                if (data.message.includes('đăng nhập') || data.message.includes('Không có quyền')) {
                    Swal.fire({
                        title: 'Phiên đăng nhập hết hạn',
                        text: 'Vui lòng đăng nhập lại',
                        icon: 'warning',
                        confirmButtonText: 'Đăng nhập',
                        confirmButtonColor: '#ff0080',
                        allowOutsideClick: false,
                        customClass: {
                            popup: 'custom-swal-popup',
                            title: 'custom-swal-title',
                            confirmButton: 'custom-swal-confirm'
                        }
                    }).then(() => {
                        window.location.href = '/auth';
                    });
                } else {
                    setMessages(prev => [...prev, {
                        id: generateUniqueId(),
                        sender: 'system',
                        content: `❌ Lỗi: ${data.message}`,
                        timestamp: new Date()
                    }]);
                }
                setIsTyping(false);
            }
        };
        
        wsRef.current.onerror = () => {
            setIsConnected(false);
        };
    };
    
    const updateChatCache = (chatId, currentMessages) => {
        setChats(prevChats => prevChats.map(chat => {
            if (chat.id === chatId) {
                return {
                    ...chat,
                    messages: currentMessages.map(msg => ({
                        id: msg.id,
                        chat_id: chatId,
                        sender: msg.sender,
                        content: msg.content,
                        attachment: msg.attachment,
                        searchData: msg.searchData || null,
                        created_at: safeToISOString(msg.timestamp)
                    })),
                    message_count: currentMessages.length,
                    last_message_at: new Date().toISOString()
                };
            }
            return chat;
        }));
    };
    
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileName = file.name;
        const fileExt = fileName.split('.').pop().toLowerCase();
        const isImage = file.type.startsWith('image/');
        const isCode = CODE_EXTENSIONS.includes(fileExt);
        const isText = file.type.startsWith('text/') || isCode;
        
        const maxSize = isImage ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
            Swal.fire({
                title: 'File quá lớn!',
                text: `Vui lòng chọn file dưới ${isImage ? '10MB' : '5MB'}`,
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080',
                customClass: {
                    popup: 'custom-swal-popup',
                    title: 'custom-swal-title',
                    confirmButton: 'custom-swal-confirm'
                }
            });
            return;
        }
        
        setSelectedFile(file);
        
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setFilePreview({
                    type: 'image',
                    url: e.target.result,
                    name: fileName,
                    size: formatFileSize(file.size),
                    icon: getFileIcon(fileName)
                });
            };
            reader.readAsDataURL(file);
        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setFileContent(e.target.result);
                setFilePreview({
                    type: 'code',
                    name: fileName,
                    size: formatFileSize(file.size),
                    icon: getFileIcon(fileName),
                    language: getLanguageFromExt(fileExt)
                });
            };
            reader.readAsText(file);
        } else {
            setFilePreview({
                type: 'file',
                name: fileName,
                size: formatFileSize(file.size),
                icon: getFileIcon(fileName)
            });
        }
    };
    
    const removeSelectedFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        setFileContent(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const sendMessage = () => {
        if ((!inputValue.trim() && !selectedFile) || !wsRef.current || isTyping) return;
        if (wsRef.current.readyState !== WebSocket.OPEN) return;
        
        if (!activeChat) {
            Swal.fire({
                title: 'Chưa chọn cuộc trò chuyện',
                text: 'Vui lòng chọn hoặc tạo một cuộc trò chuyện mới',
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080',
                customClass: {
                    popup: 'custom-swal-popup',
                    title: 'custom-swal-title',
                    confirmButton: 'custom-swal-confirm'
                }
            });
            return;
        }
        
        const userInputText = inputValue.trim();
        const hasFile = !!selectedFile;
        const hasText = !!userInputText;
        
        const displayMessage = {
            id: generateUniqueId(),
            sender: 'user',
            content: userInputText,
            timestamp: new Date(),
            attachment: hasFile ? filePreview : null
        };
        
        setIsNearBottom(true);
        setMessages(prev => [...prev, displayMessage]);
        
        let serverMessage = {
            type: 'user_message',
            content: userInputText,
            chatId: activeChat.id
        };
        
        if (hasFile) {
            if (filePreview.type === 'image') {
                serverMessage.image = filePreview.url;
                if (!hasText) {
                    serverMessage.content = "Hãy mô tả và phân tích hình ảnh này chi tiết";
                }
            } else if (filePreview.type === 'code' && fileContent) {
                const langName = filePreview.language.toLowerCase();
                const codePrompt = hasText ? userInputText : 
                    `Hãy phân tích code ${filePreview.language} này:\n\nFile: ${filePreview.name}`;
                serverMessage.content = codePrompt + '\n\n```' + langName + '\n' + fileContent + '\n```';
            } else {
                if (!hasText) {
                    serverMessage.content = `Tôi đã upload file: ${filePreview.name} (${filePreview.size})`;
                }
            }
        }
        
        wsRef.current.send(JSON.stringify(serverMessage));
        
        setInputValue('');
        removeSelectedFile();
        setIsTyping(true);
        
        setTimeout(() => {
            setMessages(currentMessages => {
                updateChatCache(activeChat.id, currentMessages);
                return currentMessages;
            });
        }, 100);
    };
    
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    
    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Đăng xuất?',
            text: 'Bạn chắc chắn muốn đăng xuất không?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'OK',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#ff0080',
            cancelButtonColor: '#6c757d',
            reverseButtons: true,
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-swal-title',
                htmlContainer: 'custom-swal-text',
                confirmButton: 'custom-swal-confirm',
                cancelButton: 'custom-swal-cancel'
            },
            showClass: {
                popup: 'animate__animated animate__fadeInDown'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutUp'
            }
        });
        
        if (result.isConfirmed) {
            try {
                Swal.fire({
                    title: 'Đang đăng xuất...',
                    text: 'Vui lòng chờ một chút',
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    customClass: {
                        popup: 'custom-swal-popup',
                        title: 'custom-swal-title'
                    },
                    willOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                const csrfResponse = await fetch('/api/csrf');
                const csrfData = await csrfResponse.json();
                
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfData.csrf_token
                    },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    document.cookie = 'auth_token=; Max-Age=0; path=/';
                    document.cookie = 'csrf_token=; Max-Age=0; path=/';
                    
                    await Swal.fire({
                        title: 'Đã đăng xuất!',
                        text: 'Hẹn gặp lại bạn sau nhé!',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        customClass: {
                            popup: 'custom-swal-popup',
                            title: 'custom-swal-title'
                        }
                    });
                    
                    window.location.href = '/auth';
                } else {
                    throw new Error('Logout failed');
                }
            } catch (error) {
                Swal.fire({
                    title: 'Lỗi!',
                    text: 'Không thể đăng xuất. Vui lòng thử lại.',
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#ff0080',
                    customClass: {
                        popup: 'custom-swal-popup',
                        title: 'custom-swal-title',
                        confirmButton: 'custom-swal-confirm'
                    }
                });
            }
        }
    };
    
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    const scrollToBottomSmooth = () => {
        setIsNearBottom(true);
        scrollToBottom();
        setShowScrollButton(false);
    };
    
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const nearBottom = distanceFromBottom < 100;
        
        setIsNearBottom(nearBottom);
        setShowScrollButton(!nearBottom && messages.length > 0);
    };
    
    const formatTime = (date) => {
        try {
            if (date instanceof Date && !isNaN(date)) {
                return date.toLocaleTimeString('vi-VN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }
        } catch (e) {
            console.warn('Invalid date for formatting:', date);
        }
        return '--:--';
    };
    
    const openImageModal = (imageUrl) => {
        Swal.fire({
            imageUrl: imageUrl,
            imageAlt: 'Ảnh đầy đủ',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                popup: 'image-modal'
            }
        });
    };
    
    const handleProfileClick = () => {
        window.location.href = '/profile';
    };
    
    if (authChecking) {
        return (
            <div className="auth-checking">
                <div className="loading-spinner"></div>
                <p>Đang kiểm tra xác thực...</p>
            </div>
        );
    }
    
    return (
        <div className={`container ${loaded ? 'loaded' : ''}`}>
            <div className="header">
                <div className="title-wrapper">
                    <h1 className="title">TMGPT</h1>
                    <span className="title-badge">dashboard</span>
                </div>
                <p className="caption">The best AI in the World</p>
            </div>
            
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
                <span>{isConnected ? 'Đã kết nối' : 'Đang kết nối...'}</span>
            </div>
            
            <button 
                className="hamburger-menu"
                onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
                title="Menu cuộc trò chuyện"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            
            {user && (
                <div 
                    className="user-info"
                    onMouseEnter={() => setUserMenuOpen(true)}
                    onMouseLeave={() => setUserMenuOpen(false)}
                    ref={userMenuRef}
                >
                    {renderUserAvatar(false)}
                    <span className="user-name">{user.username}</span>
                    
                    <div className={`user-dropdown ${userMenuOpen ? 'show' : ''}`}>
                        <button className="dropdown-item profile-btn" onClick={handleProfileClick}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
                                <path d="M16 14H8C5.79086 14 4 15.7909 4 18V20H20V18C20 15.7909 18.2091 14 16 14Z" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            <span>Profile</span>
                        </button>
                        <div className="dropdown-divider"></div>
                        <button className="dropdown-item logout-btn" onClick={handleLogout}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M15 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H15M10 17L15 12M15 12L10 7M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
            )}
            
            <>
                <div className={`chat-sidebar-overlay ${chatSidebarOpen ? 'open' : ''}`} 
                     onClick={() => setChatSidebarOpen(false)}></div>
                <div className={`chat-sidebar-menu ${chatSidebarOpen ? 'open' : ''}`}>
                    <div className="chat-sidebar-header">
                        <h3>Cuộc trò chuyện</h3>
                        <button className="sidebar-close-btn" onClick={() => setChatSidebarOpen(false)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="chat-sidebar-actions">
                        <button className="chat-action-btn new-chat" onClick={createNewChat}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Tạo Chat Mới</span>
                        </button>
                        <button className="chat-action-btn clear-chat" onClick={clearCurrentChat}
                                disabled={!activeChat || messages.length === 0}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Xóa nội dung</span>
                        </button>
                    </div>
                    
                    <div className="chat-list">
                        {chatsLoaded && chats.length === 0 ? (
                            <div className="no-chats">
                                <p>Chưa có cuộc trò chuyện nào</p>
                                <small>Nhấn "Tạo Chat Mới" để bắt đầu</small>
                            </div>
                        ) : (
                            chats.map(chat => (
                                <div 
                                    key={chat.id} 
                                    className={`chat-item ${activeChat && activeChat.id === chat.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveChat(chat);
                                        setChatSidebarOpen(false);
                                    }}
                                >
                                    <div className="chat-item-info">
                                        <h4>{escapeHTML(chat.name)}</h4>
                                        <small>{chat.message_count || 0} tin nhắn</small>
                                    </div>
                                    <button 
                                        className="chat-delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteChat(chat.id, chat.name);
                                        }}
                                        title="Xóa cuộc trò chuyện"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <div className="chat-sidebar-footer">
                        <small>Tối đa 10 cuộc trò chuyện</small>
                        <small>{chats.length}/10</small>
                    </div>
                </div>
            </>
            
            <div className="chat-container">
                <div className="messages-area" onScroll={handleScroll} ref={messagesAreaRef}>
                    {!activeChat ? (
                        <div className="welcome-message">
                            <div className="welcome-icon">
                                <img src="/haigpt.webp" alt="HaiGPT" className="welcome-avatar" />
                            </div>
                            <h3>Chào mừng đến với TMGPT!</h3>
                            <p>Vui lòng chọn một cuộc trò chuyện hoặc tạo mới để bắt đầu</p>
                            <button className="create-chat-cta" onClick={() => setChatSidebarOpen(true)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                Mở Menu Chat
                            </button>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="welcome-message">
                            <div className="welcome-icon">
                                <img src="/haigpt.webp" alt="HaiGPT" className="welcome-avatar" />
                            </div>
                            <h3>Chào mừng đến với TMGPT!</h3>
                            <p>Tôi là AI thông minh nhất thế giới. Hãy hỏi tôi bất cứ điều gì!</p>
                        </div>
                    ) : (
                        <div className="messages-list">
                            {messages.map((message) => (
                                <div key={message.id} className={`message-row ${message.sender}`}>
                                    <div className="message-avatar">
                                        {message.sender === 'user' ? (
                                            renderUserAvatar(true)
                                        ) : message.sender === 'assistant' ? (
                                            <img src="/haigpt.webp" alt="HaiGPT" className="ai-avatar" />
                                        ) : (
                                            <div className="system-avatar">⚠️</div>
                                        )}
                                    </div>
                                    <div className="message-body">
                                        <div className="message-header">
                                            <span className="message-sender">
                                                {message.sender === 'user' ? (user && user.username) : 
                                                 message.sender === 'assistant' ? 'HaiGPT' : 'System'}
                                            </span>
                                            <span className="message-time">
                                                {formatTime(message.timestamp)}
                                            </span>
                                        </div>
                                        <div className="message-content">
                                            {message.attachment && (
                                                <div className="message-attachment">
                                                    {message.attachment.type === 'image' ? (
                                                        <div className="attachment-image">
                                                            <img 
                                                                src={message.attachment.url} 
                                                                alt={escapeHTML(message.attachment.name)}
                                                                onClick={() => openImageModal(message.attachment.url)}
                                                            />
                                                            <div className="attachment-info">
                                                                <span className="file-icon">{message.attachment.icon}</span>
                                                                <span className="file-name">{escapeHTML(message.attachment.name)}</span>
                                                                <span className="file-size">{message.attachment.size}</span>
                                                            </div>
                                                        </div>
                                                    ) : message.attachment.type === 'code' ? (
                                                        <div className="attachment-file code-file">
                                                            <span className="file-icon">{message.attachment.icon}</span>
                                                            <div className="file-details">
                                                                <span className="file-name">{escapeHTML(message.attachment.name)}</span>
                                                                <span className="file-meta">{message.attachment.language} • {message.attachment.size}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="attachment-file">
                                                            <span className="file-icon">{message.attachment.icon}</span>
                                                            <div className="file-details">
                                                                <span className="file-name">{escapeHTML(message.attachment.name)}</span>
                                                                <span className="file-meta">{message.attachment.size}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <MessageContent 
                                                content={message.content} 
                                                isStreaming={message.isStreaming}
                                                searchData={message.searchData}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {isTyping && (
                                <div className="message-row assistant typing">
                                    <div className="message-avatar">
                                        <img src="/haigpt.webp" alt="TMGPT" className="ai-avatar" />
                                    </div>
                                    <div className="message-body">
                                        <div className="message-header">
                                            <span className="message-sender">TMGPT</span>
                                        </div>
                                        <div className="typing-indicator">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
                
                {showScrollButton && (
                    <button 
                        className="scroll-to-bottom show"
                        onClick={scrollToBottomSmooth}
                        title="Xuống cuối"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M7 14L12 19L17 14H7Z" fill="currentColor"/>
                        </svg>
                    </button>
                )}
                
                <div className="input-area">
                    {filePreview && (
                        <div className="file-preview-container">
                            {filePreview.type === 'image' ? (
                                <div className="preview-image">
                                    <img src={filePreview.url} alt={escapeHTML(filePreview.name)} />
                                    <div className="preview-info">
                                        <span className="file-icon">{filePreview.icon}</span>
                                        <span className="file-name">{escapeHTML(filePreview.name)}</span>
                                        <span className="file-size">{filePreview.size}</span>
                                    </div>
                                    <button className="remove-file" onClick={removeSelectedFile}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <div className="preview-file">
                                    <div className="preview-info">
                                        <span className="file-icon">{filePreview.icon}</span>
                                        <div className="file-details">
                                            <span className="file-name">{escapeHTML(filePreview.name)}</span>
                                            <span className="file-meta">
                                                {filePreview.language ? `${filePreview.language} • ` : ''}{filePreview.size}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="remove-file" onClick={removeSelectedFile}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="input-wrapper">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*,.py,.js,.jsx,.ts,.tsx,.html,.htm,.css,.scss,.sass,.c,.cpp,.cc,.cxx,.h,.hpp,.cs,.java,.php,.rb,.go,.rs,.swift,.kt,.json,.xml,.yaml,.yml,.sql,.sh,.bash,.zsh,.bat,.cmd,.ps1,.md,.txt,.log,.ini,.conf,.config"
                            style={{ display: 'none' }}
                        />
                        
                        <button 
                            className="attach-button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!isConnected || isTyping || !activeChat}
                            title="Đính kèm file"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" 
                                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder={!activeChat ? "Chọn một cuộc trò chuyện..." : 
                                selectedFile ? 
                                (filePreview?.type === 'code' ? "Hỏi về code này..." : "Thêm chú thích...") : 
                                "Nhắn tin với HaiGPT..."}
                            disabled={!isConnected || isTyping || !activeChat}
                            rows="1"
                        />
                        
                        <button 
                            onClick={sendMessage}
                            disabled={(!inputValue.trim() && !selectedFile) || !isConnected || isTyping || !activeChat}
                            className="send-button"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

ReactDOM.render(<ChatApp />, document.getElementById('root'));