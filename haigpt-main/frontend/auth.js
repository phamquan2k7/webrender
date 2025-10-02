const { useState, useEffect, useRef } = React;

const AuthPage = () => {
    const [activeTab, setActiveTab] = useState('login');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        repassword: ''
    });

    useEffect(() => {
        Swal.mixin({
            customClass: {
                popup: 'swal2-popup',
                title: 'swal2-title',
                content: 'swal2-content',
                confirmButton: 'swal2-confirm',
                cancelButton: 'swal2-cancel'
            },
            buttonsStyling: false
        });
    }, []);

    const getCsrfToken = () => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; csrf_token=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    };

    const showSuccess = (title, text, callback) => {
        Swal.fire({
            icon: 'success',
            title: title,
            text: text,
            showConfirmButton: true,
            confirmButtonText: 'Tuyệt vời!',
            timer: 3000,
            timerProgressBar: true
        }).then(() => {
            if (callback) callback();
        });
    };

    const showError = (title, text) => {
        Swal.fire({
            icon: 'error',
            title: title,
            text: text,
            showConfirmButton: true,
            confirmButtonText: 'Thử lại',
            confirmButtonColor: '#dc3545'
        });
    };

    const showLoading = (title) => {
        Swal.fire({
            title: title,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);

        if (activeTab === 'register') {
            if (formData.username.length < 3) {
                showError('Lỗi đăng ký', 'Tên đăng nhập phải có ít nhất 3 ký tự');
                setLoading(false);
                return;
            }
            
            if (formData.password.length < 6) {
                showError('Lỗi đăng ký', 'Mật khẩu phải có ít nhất 6 ký tự');
                setLoading(false);
                return;
            }
            
            if (formData.password !== formData.repassword) {
                showError('Lỗi đăng ký', 'Mật khẩu nhập lại không khớp');
                setLoading(false);
                return;
            }
        }

        showLoading(activeTab === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...');

        try {
            const endpoint = activeTab === 'login' ? '/api/login' : '/api/register';
            const payload = activeTab === 'login' 
                ? { 
                    username: formData.username, 
                    password: formData.password
                }
                : { 
                    username: formData.username, 
                    password: formData.password, 
                    repassword: formData.repassword
                };

            const headers = {
                'Content-Type': 'application/json'
            };

            const csrfToken = getCsrfToken();
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                if (activeTab === 'login') {
                    showSuccess(
                        '🎉 Chào mừng trở lại!', 
                        `Xin chào ${formData.username}! Bạn đã đăng nhập thành công.`,
                        () => {
                            window.location.href = '/dashboard';
                        }
                    );
                } else {
                    showSuccess(
                        '🚀 Tài khoản đã được tạo!', 
                        'Chúc mừng! Bạn có thể đăng nhập ngay bây giờ.',
                        () => {
                            setActiveTab('login');
                            setFormData({ username: formData.username, password: '', repassword: '' });
                        }
                    );
                }
            } else {
                const errorTitle = activeTab === 'login' ? '❌ Đăng nhập thất bại' : '❌ Đăng ký thất bại';
                showError(errorTitle, data.error || 'Đã có lỗi xảy ra');
            }
        } catch (error) {
            showError('🔌 Lỗi kết nối', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = () => {
        if (!formData.username.trim() || !formData.password.trim()) return false;
        if (activeTab === 'register' && !formData.repassword.trim()) return false;
        return true;
    };

    const switchTab = (newTab) => {
        const hasData = formData.username || formData.password || formData.repassword;
        
        if (hasData) {
            Swal.fire({
                title: '🔄 Chuyển tab?',
                text: 'Dữ liệu đã nhập sẽ bị xóa. Bạn có chắc chắn muốn chuyển?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Có, chuyển đi',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#ff0080',
                cancelButtonColor: '#6c757d'
            }).then((result) => {
                if (result.isConfirmed) {
                    setActiveTab(newTab);
                    setFormData({ username: '', password: '', repassword: '' });
                }
            });
        } else {
            setActiveTab(newTab);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-header">
                <h1 className="auth-title">TMGPT</h1>
                <p className="auth-subtitle">Trải nghiệm AI thông minh nhất thế giới</p>
            </div>

            <div className="form-container">
                <div className="tab-buttons">
                    <div className={`tab-indicator ${activeTab === 'register' ? 'register' : ''}`}></div>
                    <button 
                        className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
                        onClick={() => switchTab('login')}
                    >
                        Đăng nhập
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
                        onClick={() => switchTab('register')}
                    >
                        Tạo tài khoản
                    </button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {activeTab === 'login' ? (
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Tên đăng nhập</label>
                                <input
                                    type="text"
                                    name="username"
                                    className="form-input"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    placeholder="Nhập tên đăng nhập"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mật khẩu</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="form-input"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Nhập mật khẩu"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="form-group full-width">
                                <label className="form-label">Tên đăng nhập</label>
                                <input
                                    type="text"
                                    name="username"
                                    className="form-input"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    placeholder="Chọn tên đăng nhập (ít nhất 3 ký tự)"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Mật khẩu</label>
                                    <input
                                        type="password"
                                        name="password"
                                        className="form-input"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="Tạo mật khẩu (ít nhất 6 ký tự)"
                                        required
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Xác nhận mật khẩu</label>
                                    <input
                                        type="password"
                                        name="repassword"
                                        className="form-input"
                                        value={formData.repassword}
                                        onChange={handleInputChange}
                                        placeholder="Nhập lại mật khẩu"
                                        required
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="submit-section">
                        <button 
                            type="submit" 
                            className="submit-button"
                            disabled={!isFormValid() || loading}
                        >
                            {loading ? (
                                <span className="loading">
                                    <span className="spinner"></span>
                                    {activeTab === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}
                                </span>
                            ) : (
                                <>
                                    {activeTab === 'login' ? '🔐 Đăng nhập' : '🚀 Tạo tài khoản'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="auth-footer">
                <p>🔒 Bảo mật và an toàn</p>
            </div>
        </div>
    );
};

ReactDOM.render(<AuthPage />, document.getElementById('root'));