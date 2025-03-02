let timeoutId;
// 假设的switchLight函数，实际需按业务完善
function switchLight(status) {
    console.log(`切换信号灯状态为 ${status}`);
    // 这里可以添加与后端交互，真正切换信号灯状态的代码
}

function initChart() {
    const chart = echarts.init(document.getElementById('traffic-map'));
    chart.setOption({
        title: { text: '实时车流量' },
        xAxis: { type: 'time' },
        yAxis: { type: 'value' },
        series: [{ data: [], type: 'line' }]
    });
    const ws = new WebSocket('ws://localhost:3000/ws');
    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        chart.appendData({ seriesIndex: 0, data: [[data.timestamp, data.vehicle_count]] });
    };
}

// 退出登录功能
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    // 清除本地存储
    localStorage.removeItem('token');
    // 跳转登录页
    window.location.href = 'login.html';
});