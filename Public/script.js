// 初始化配置
// 用于存储图表数据的数组
let chartData = [];
// 图表数据的最大点数，超过该数量会移除最早的数据点
const MAX_DATA_POINTS = 100;

// 初始化图表的函数
function initChart() {
    // 使用 echarts 初始化指定 ID 的 DOM 元素为图表
    const chart = echarts.init(document.getElementById('traffic-map'));

    // 增强型配置，定义图表的各种属性
    const option = {
        // 图表标题配置
        title: {
            // 主标题文本
            text: '实时车流量监控',
            // 副标题文本，显示数据更新周期和当前时间
            subtext: '数据更新周期：5 秒 | 当前时间：2025-03-06 13:13',
            // 标题居中显示
            left: 'center'
        },
        // 鼠标悬停时的提示框配置
        tooltip: {
            // 触发类型为坐标轴触发
            trigger: 'axis',
            // 自定义提示框内容的格式化函数
            formatter: (params) => {
                // 将数据中的时间戳转换为 Date 对象
                const date = new Date(params[0].value[0]);
                // 返回格式化后的提示框内容，包含时间和车流量
                return `时间：${date.toLocaleString()}<br/> 车流量：${params[0].value[1]}辆`;
            }
        },
        // x 轴配置
        xAxis: {
            // 类型为时间轴
            type: 'time',
            // x 轴标签的格式化函数
            axisLabel: {
                formatter: (value) => {
                    // 将时间戳转换为 Date 对象
                    const date = new Date(value);
                    // 格式化显示小时和分钟
                    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                }
            },
            // 不显示网格线
            splitLine: { show: false }
        },
        // y 轴配置
        yAxis: {
            // y 轴名称
            name: '车辆数（辆）',
            // 类型为数值轴
            type: 'value',
            // y 轴最小值
            min: 0,
            // y 轴最大值
            max: 10
        },
        // 系列数据配置
        series: [{
            // 系列名称
            name: '实时车流',
            // 图表类型为折线图
            type: 'line',
            // 折线平滑显示
            smooth: true,
            // 不显示数据点标记
            showSymbol: false,
            // 折线颜色
            itemStyle: { color: '#1890ff' },
            // 折线下方区域的样式配置
            areaStyle: {
                // 使用线性渐变填充
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    // 渐变起始颜色
                    { offset: 0, color: 'rgba(24,144,255,0.6)' },
                    // 渐变结束颜色
                    { offset: 1, color: 'rgba(24,144,255,0.02)' }
                ])
            }
        }]
    };

    // 将配置应用到图表上
    chart.setOption(option);
    // 返回初始化好的图表对象
    return chart;
}

// WebSocket 连接增强版函数
function connectWebSocket(chart) {
    // 创建 WebSocket 连接
    let ws = new WebSocket('ws://localhost:3000');

    // 当接收到 WebSocket 消息时的处理函数
    ws.onmessage = (e) => {
        try {
            // 解析接收到的 JSON 数据
            const data = JSON.parse(e.data);
            // 检查数据中是否包含时间戳和车流量信息
            if (data.timestamp && data.vehicle_count) {
                // 将时间戳转换为时间戳数值
                const timestamp = new Date(data.timestamp).getTime();

                // 数据队列管理，如果数据点数量超过最大限制，移除最早的数据点
                if (chartData.length >= MAX_DATA_POINTS) chartData.shift();
                // 将新的数据点添加到数据数组中
                chartData.push([timestamp, data.vehicle_count]);

                // 增量渲染，更新图表的系列数据
                chart.setOption({
                    series: [{
                        data: chartData
                    }]
                });
            }
        } catch (error) {
            // 打印数据处理异常信息
            console.error(' 数据处理异常:', error);
        }
    };

    // 当 WebSocket 连接关闭时的处理函数，自动重连机制
    ws.onclose = () => setTimeout(() => connectWebSocket(chart), 5000);
    // 当 WebSocket 连接出错时，关闭连接
    ws.onerror = () => ws.close();
}

// 初始化流程，当 DOM 内容加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 检查本地存储中是否存在 token，如果不存在则跳转到登录页面
    if (!localStorage.getItem('token')) window.location.href = 'login.html';

    // 初始化图表
    const chart = initChart();
    // 建立 WebSocket 连接
    connectWebSocket(chart);
});

// 切换信号灯的函数
function switchLight(color) {
    // 检查本地存储中的角色是否为管理员，如果不是则提示错误并返回
    if (localStorage.getItem('role') !== 'admin') {
        alert('错误：需管理员权限操作');
        return;
    }

    // 发送 POST 请求到后端控制信号灯
    fetch('/api/control-signal', {
        method: 'POST',
        headers: {
            // 请求体的内容类型为 JSON
            'Content-Type': 'application/json',
            // 添加认证信息，使用本地存储中的 token
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        // 请求体数据，包含要执行的动作和路口信息
        body: JSON.stringify({
            action: color,
            intersection: 'intersection_01'
        })
    })
   .then(response => {
        // 检查响应状态是否正常，如果不正常则抛出错误
        if (!response.ok) throw new Error(`HTTP 错误 ${response.status}`);
        // 将响应数据解析为 JSON
        return response.json();
    })
   .then(data => {
        // 显示状态指示器，提示信号切换生效及剩余时间
        showStatusIndicator(data.duration);
    })
   .catch(error => {
        // 打印增强型错误捕获信息
        console.error(' 增强型错误捕获:', error);
        // 提示控制失败信息
        alert(`控制失败: ${error.message}`);
    });
}

// 显示状态指示器的函数
function showStatusIndicator(duration) {
    // 创建一个新的 div 元素作为状态指示器
    const indicator = document.createElement('div');
    // 添加类名
    indicator.className = 'status-indicator';
    // 设置指示器的 HTML 内容，包含加载动画和剩余时间提示
    indicator.innerHTML = `
        <div class="spinner"></div>
        <p>信号切换生效中（剩余${duration}秒）</p>
    `;
    // 将指示器添加到页面主体中
    document.body.appendChild(indicator);
    // 定时器，在指定时间后移除指示器
    setTimeout(() => indicator.remove(), duration * 1000);
}

// 退出登录的处理函数
// 退出登录功能
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    // 清除本地存储
    localStorage.removeItem('token');
    // 跳转登录页
    window.location.href = 'login.html';
});