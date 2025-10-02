const { useState, useEffect } = React;

const Dashboard = () => {
    const [loaded, setLoaded] = useState(false);
    
    useEffect(() => {
        // Trigger animations after mount
        setTimeout(() => setLoaded(true), 100);
    }, []);
    
    const handleDashboardClick = () => {
        window.location.href = '/dashboard';
    };
    
    const smallFeatures = [
        {
            emoji: "⚡",
            title: "Tốc độ",
            content: "TMGPT là một AI có tốc độ phản hồi cực kì nhanh, hơn cả tốc độ quay mặt của nyc của bạn :))"
        },
        {
            emoji: "🧠",
            title: "Thông minh",
            content: "TMGPT có đầu óc thông minh, cực kì thông minh, có thể sánh ngang anh sờ tanh hay niu tơn"
        }
    ];
    
    const largeFeature = {
        emoji: "⚙️",
        title: "Engine",
        content: (
            <span>
                TMGPT có engine là tất cả hơn <span className="highlight">1 triệu AI</span> giỏi nhất 
                từ khắp thế giới kết hợp lại, tạo nên một AI mạnh nhất với tốc độ trả lời siêu nhanh 
                kèm theo kết quả chính xác tới từng mi li mét. TMGPT từng bị <span className="highlight">OpenAI</span> xin 
                mua lại với mức giá lên tới <span className="highlight">8 triệu bitcoin</span> và <span className="highlight">Google</span> với 
                giá <span className="highlight">20 triệu bitcoin</span>
            </span>
        )
    };
    
    return (
        <div className="container">
            {/* Dashboard Button */}
            <button className="dashboard-btn" onClick={handleDashboardClick}>
                <svg className="dashboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <span className="dashboard-text">Dashboard</span>
                <div className="dashboard-glow"></div>
            </button>
            
            {/* Header Section */}
            <div className="header">
                <h1 className="title">TMGPT</h1>
                <p className="caption">Best AI in the World</p>
            </div>
            
            {/* Feature Boxes */}
            <div className="features">
                {/* Small Feature Boxes */}
                {smallFeatures.map((feature, index) => (
                    <div key={index} className="feature-box small">
                        <div className="feature-title">
                            <span className="feature-emoji">{feature.emoji}</span>
                            <span>{feature.title}</span>
                        </div>
                        <div className="feature-content">
                            {feature.content}
                        </div>
                    </div>
                ))}
                
                {/* Large Feature Box */}
                <div className="feature-box large">
                    <div className="feature-title">
                        <span className="feature-emoji">{largeFeature.emoji}</span>
                        <span>{largeFeature.title}</span>
                    </div>
                    <div className="feature-content">
                        {largeFeature.content}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Render
ReactDOM.render(<Dashboard />, document.getElementById('root'));