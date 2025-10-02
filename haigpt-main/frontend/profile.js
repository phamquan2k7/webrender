const { useState, useEffect, useRef } = React;

// Get avatar colors
const getAvatarColor = (index) => {
    const colors = [
        '#ff0080', '#ff8c00', '#40e0d0', '#0080ff', 
        '#8000ff', '#32cd32', '#ff6347', '#9370db', 
        '#20b2aa', '#ffa500', '#dc143c', '#00ced1'
    ];
    return colors[index % colors.length];
};

const ProfileApp = () => {
    const [user, setUser] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    
    // Form states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    // Avatar state
    const [selectedAvatar, setSelectedAvatar] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    
    const fileInputRef = useRef(null);
    
    useEffect(() => {
        checkAuthAndLoadProfile();
    }, []);
    
    const checkAuthAndLoadProfile = async () => {
        try {
            const response = await fetch('/api/profile', {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                window.location.href = '/auth';
                return;
            }
            
            const data = await response.json();
            setUser(data.user);
            setTimeout(() => setLoaded(true), 100);
        } catch (error) {
            console.error('Error loading profile:', error);
            window.location.href = '/auth';
        }
    };
    
    const showSuccess = (message) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(''), 4000);
    };
    
    const handleAvatarSelect = (index) => {
        setSelectedAvatar(index);
        setAvatarFile(null);
        setAvatarPreview(null);
    };
    
    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            Swal.fire({
                title: 'Lỗi!',
                text: 'Vui lòng chọn file ảnh',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080'
            });
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                title: 'File quá lớn!',
                text: 'Vui lòng chọn ảnh dưới 5MB',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080'
            });
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            setAvatarPreview(e.target.result);
            setAvatarFile(file);
            setSelectedAvatar(null);
        };
        reader.readAsDataURL(file);
    };
    
    const handleSaveAvatar = async () => {
        try {
            setLoading(true);
            
            const csrfResponse = await fetch('/api/csrf');
            const csrfData = await csrfResponse.json();
            
            const avatarData = avatarFile ? avatarPreview : `color:${selectedAvatar}`;
            
            const response = await fetch('/api/profile/avatar', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfData.csrf_token
                },
                body: JSON.stringify({ avatar: avatarData }),
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                setShowAvatarModal(false);
                showSuccess('Avatar đã được cập nhật thành công!');
            } else {
                throw new Error('Failed to update avatar');
            }
        } catch (error) {
            console.error('Error updating avatar:', error);
            Swal.fire({
                title: 'Lỗi!',
                text: 'Không thể cập nhật avatar',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080'
            });
        } finally {
            setLoading(false);
        }
    };
    
    const handleChangePassword = async (e) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            Swal.fire({
                title: 'Lỗi!',
                text: 'Mật khẩu mới không khớp',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080'
            });
            return;
        }
        
        if (newPassword.length < 6) {
            Swal.fire({
                title: 'Lỗi!',
                text: 'Mật khẩu mới phải có ít nhất 6 ký tự',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080'
            });
            return;
        }
        
        try {
            setLoading(true);
            
            const csrfResponse = await fetch('/api/csrf');
            const csrfData = await csrfResponse.json();
            
            const response = await fetch('/api/profile/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfData.csrf_token
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                }),
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                showSuccess('Mật khẩu đã được thay đổi thành công!');
            } else {
                throw new Error(data.error || 'Failed to change password');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            Swal.fire({
                title: 'Lỗi!',
                text: error.message || 'Không thể đổi mật khẩu',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ff0080'
            });
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteAccount = async () => {
        const result = await Swal.fire({
            title: 'Xác nhận xóa tài khoản?',
            html: `
                <p style="color: #666; margin-bottom: 20px;">Hành động này không thể hoàn tác!</p>
                <p style="color: #dc3545; font-weight: 600;">Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn.</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xóa tài khoản',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            reverseButtons: true
        });
        
        if (result.isConfirmed) {
            const confirmResult = await Swal.fire({
                title: 'Nhập mật khẩu để xác nhận',
                input: 'password',
                inputPlaceholder: 'Nhập mật khẩu hiện tại',
                inputAttributes: {
                    autocapitalize: 'off'
                },
                showCancelButton: true,
                confirmButtonText: 'Xác nhận xóa',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                preConfirm: (password) => {
                    if (!password) {
                        Swal.showValidationMessage('Vui lòng nhập mật khẩu');
                    }
                    return password;
                }
            });
            
            if (confirmResult.isConfirmed) {
                try {
                    setLoading(true);
                    
                    const csrfResponse = await fetch('/api/csrf');
                    const csrfData = await csrfResponse.json();
                    
                    const response = await fetch('/api/profile', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfData.csrf_token
                        },
                        body: JSON.stringify({
                            password: confirmResult.value
                        }),
                        credentials: 'same-origin'
                    });
                    
                    if (response.ok) {
                        await Swal.fire({
                            title: 'Tài khoản đã bị xóa!',
                            text: 'Cảm ơn bạn đã sử dụng TMGPT',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        
                        window.location.href = '/auth';
                    } else {
                        throw new Error('Failed to delete account');
                    }
                } catch (error) {
                    console.error('Error deleting account:', error);
                    Swal.fire({
                        title: 'Lỗi!',
                        text: 'Không thể xóa tài khoản. Vui lòng kiểm tra mật khẩu.',
                        icon: 'error',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#ff0080'
                    });
                } finally {
                    setLoading(false);
                }
            }
        }
    };
    
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    const renderAvatar = () => {
        if (user.avatar && user.avatar.startsWith('data:image')) {
            return <img src={user.avatar} alt="Avatar" className="avatar-img" />;
        } else if (user.avatar && user.avatar.startsWith('color:')) {
            const colorIndex = parseInt(user.avatar.split(':')[1]);
            return (
                <div 
                    className="avatar-letter" 
                    style={{ background: getAvatarColor(colorIndex) }}
                >
                    {user.username.charAt(0).toUpperCase()}
                </div>
            );
        } else {
            return (
                <div 
                    className="avatar-letter" 
                    style={{ background: getAvatarColor(0) }}
                >
                    {user.username.charAt(0).toUpperCase()}
                </div>
            );
        }
    };
    
    if (!user) {
        return (
            <div className="loading-overlay show">
                <div className="loading-spinner"></div>
            </div>
        );
    }
    
    return (
        <div className={`container ${loaded ? 'loaded' : ''}`}>
            {/* Header */}
            <header className="header">
                <div className="header-content">
                    <div className="title-wrapper">
                        <h1 className="title">HaiGPT</h1>
                        <span className="title-badge">profile</span>
                    </div>
                    <div className="nav-buttons">
                        <a href="/dashboard" className="nav-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Dashboard
                        </a>
                        <button className="nav-btn" onClick={() => window.location.href = '/'}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Trang chủ
                        </button>
                    </div>
                </div>
            </header>
            
            {/* Main Content */}
            <main className="main-content">
                {/* Profile Section */}
                <section className="profile-section">
                    <div className="profile-header">
                        <div className="avatar-section">
                            <div className="avatar-container" onClick={() => setShowAvatarModal(true)}>
                                {renderAvatar()}
                                <div className="avatar-overlay">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="user-info">
                            <h2 className="username">{user.username}</h2>
                            <div className="user-meta">
                                <div className="meta-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Tham gia: {formatDate(user.created_at)}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* Change Password Section */}
                <section className="form-section">
                    <h3 className="section-title">
                        <span style={{ fontSize: '28px' }}>🔒</span>
                        Đổi mật khẩu
                    </h3>
                    <p className="section-description">
                        Để bảo mật tài khoản, hãy đảm bảo mật khẩu của bạn có ít nhất 6 ký tự
                    </p>
                    
                    <form onSubmit={handleChangePassword}>
                        <div className="form-group">
                            <label className="form-label">Mật khẩu hiện tại</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showCurrentPassword ? "text" : "password"}
                                    className="form-input"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu hiện tại"
                                    required
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                >
                                    {showCurrentPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Mật khẩu mới</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    className="form-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu mới"
                                    required
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Xác nhận mật khẩu mới</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu mới"
                                    required
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            <span style={{ fontSize: '16px' }}>🔐</span>
                            Đổi mật khẩu
                        </button>
                    </form>
                </section>
                
                {/* Danger Zone */}
                <section className="danger-zone">
                    <h3 className="section-title">
                        <span style={{ fontSize: '28px' }}>⚠️</span>
                        Vùng nguy hiểm
                    </h3>
                    <p className="section-description">
                        Cẩn thận! Các hành động trong phần này không thể hoàn tác
                    </p>
                    
                    <div className="danger-warning">
                        <span style={{ fontSize: '20px' }}>ℹ️</span>
                        <p>
                            Xóa tài khoản sẽ xóa vĩnh viễn tất cả dữ liệu của bạn bao gồm: 
                            lịch sử chat, cài đặt cá nhân và mọi thông tin liên quan. 
                            Hành động này không thể khôi phục.
                        </p>
                    </div>
                    
                    <button 
                        className="btn btn-danger" 
                        onClick={handleDeleteAccount}
                        disabled={loading}
                    >
                        <span style={{ fontSize: '16px' }}>🗑️</span>
                        Xóa tài khoản
                    </button>
                </section>
            </main>
            
            {/* Avatar Modal */}
            <div className={`avatar-modal ${showAvatarModal ? 'show' : ''}`}>
                <div className="avatar-modal-content">
                    <div className="avatar-modal-header">
                        <h3 className="avatar-modal-title">Chọn avatar</h3>
                        <button 
                            className="avatar-close-btn" 
                            onClick={() => setShowAvatarModal(false)}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="avatar-options">
                        {[...Array(12)].map((_, index) => (
                            <div
                                key={index}
                                className={`avatar-option ${selectedAvatar === index ? 'selected' : ''}`}
                                style={{ background: getAvatarColor(index) }}
                                onClick={() => handleAvatarSelect(index)}
                            >
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                        ))}
                    </div>
                    
                    <div className="avatar-upload">
                        <label className="upload-label">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Tải ảnh lên
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="upload-input"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                            />
                        </label>
                        
                        {avatarPreview && (
                            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                <img 
                                    src={avatarPreview} 
                                    alt="Preview" 
                                    style={{ 
                                        width: '100px', 
                                        height: '100px', 
                                        borderRadius: '50%',
                                        objectFit: 'cover'
                                    }} 
                                />
                            </div>
                        )}
                    </div>
                    
                    <div style={{ marginTop: '30px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button 
                            className="btn" 
                            style={{ background: '#6c757d', color: 'white' }}
                            onClick={() => setShowAvatarModal(false)}
                        >
                            Hủy
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleSaveAvatar}
                            disabled={loading || (!selectedAvatar && selectedAvatar !== 0 && !avatarFile)}
                        >
                            Lưu thay đổi
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Loading Overlay */}
            <div className={`loading-overlay ${loading ? 'show' : ''}`}>
                <div className="loading-spinner"></div>
            </div>
            
            {/* Success Message - REDESIGNED */}
            <div className={`success-message ${successMessage ? 'show' : ''}`}>
                <div className="success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                              d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="success-text">
                    {successMessage}
                </div>
            </div>
        </div>
    );
};

ReactDOM.render(<ProfileApp />, document.getElementById('root'));