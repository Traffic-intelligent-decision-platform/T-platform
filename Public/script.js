// 初始化 ECharts 图表
function initChart() {
    const chart = echarts.init(document.getElementById('traffic-map'));
    chart.setOption({
        title: { text: '实时车流量' },
        xAxis: { type: 'time' },
        yAxis: { type: 'value' },
        series: [{ data: [], type: 'line' }]
    });

    // WebSocket 连接
    const ws = new WebSocket('ws://localhost:3000');
    ws.onmessage = (e) => {
    try {
        const data = JSON.parse(e.data);
        if (data.timestamp && data.vehicle_count) {
            console.log('收到交通数据:', data);
            // 更新图表数据
            chart.appendData({ seriesIndex: 0, data: [data.timestamp, data.vehicle_count] });
        } else {
            console.error('数据格式不正确，缺少必要字段');
        }
    } catch (error) {
        console.error('解析数据时出错:', error);
    }
};

    ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket 连接关闭');
    };
}

// 切换信号灯
function switchLight(color) {
    fetch(`/api/switch-light?color=${color}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('切换信号灯失败');
        }
        alert('信号灯已切换');
    })
    .catch(error => {
        console.error('错误:', error);
        alert('切换信号灯失败');
    });
}

// 退出登录
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
    } else {
        initChart(); // 初始化图表
    }
});