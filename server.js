const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;

// 配置中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 数据库连接池
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'mathresources',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// WebSocket 连接处理
wss.on('connection', (ws) => {
    console.log('新的 WebSocket 连接');
    const interval = setInterval(() => {
        const data = { timestamp: new Date().toISOString(), vehicle_count: Math.floor(Math.random() * 100) };
        ws.send(JSON.stringify(data));
    }, 5000);

    ws.on('close', () => {
        console.log('WebSocket 连接关闭');
        clearInterval(interval);
    });
});

// 注册
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (email, password, role) VALUES (?, ?, ?)';
        pool.query(sql, [email, hashedPassword, 'user'], (error, results) => {
            if (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: '该邮箱已被注册' });
                }
                return res.status(500).json({ message: '注册失败' });
            }
            res.status(201).json({ message: '注册成功' });
        });
    } catch (error) {
        res.status(500).json({ message: '注册失败' });
    }
});

// 登录
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ?';
    pool.query(sql, [email], async (error, results) => {
        if (error) {
            return res.status(500).json({ message: '登录失败' });
        }
        if (results.length === 0) {
            return res.status(400).json({ message: '邮箱或密码错误' });
        }
        const user = results[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: '邮箱或密码错误' });
        }
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            '25f752e4df71b0be1a59d89eae9807c142763538faff548ab092ed6477339dbb',
            { expiresIn: '1h' }
        );
        res.json({ token });
    });
});

// JWT认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: '未授权' });

    jwt.verify(token, '25f752e4df71b0be1a59d89eae9807c142763538faff548ab092ed6477339dbb', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token无效' });
        req.user = user;
        next();
    });
};

// 管理员权限校验中间件
const checkAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '无权操作' });
    }
    next();
};

// 处理搜索请求
app.get('/api/resources', (req, res) => {
    const { query, category } = req.query;
    let sql = 'SELECT * FROM resources WHERE 1=1';
    const params = [];

    if (query) {
        sql += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${query}%`, `%${query}%`);
    }
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }

    pool.query(sql, params, (error, results) => {
        if (error) {
            return res.status(500).json({ error: '查询失败' });
        }
        res.json(results);
    });
});

// 管理员专属路由
app.get('/api/admin/resources', authenticateToken, checkAdmin, (req, res) => {
    const sql = 'SELECT * FROM resources';
    pool.query(sql, (error, results) => {
        if (error) {
            return res.status(500).json({ error: '查询失败' });
        }
        res.json(results);
    });
});

// 获取交通数据
app.get('/api/traffic-data', (req, res) => {
    const sql = 'SELECT * FROM traffic_data ORDER BY timestamp DESC LIMIT 100';
    pool.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: '查询失败' });
        res.json(results);
    });
});

// 新增的用于存储交通数据的接口
app.post('/api/traffic-data', (req, res) => {
    const { intersection_id, vehicle_count } = req.body;

    if (!intersection_id || isNaN(vehicle_count)) {
        return res.status(400).json({ error: '参数格式错误' });
    }

    const sql = 'INSERT INTO traffic_data (intersection_id, vehicle_count) VALUES (?, ?)';
    pool.query(sql, [intersection_id, vehicle_count], (err) => {
        if (err) {
            console.error(' 数据库写入失败:', err);
            return res.status(500).json({ error: '数据存储失败' });
        }
        res.json({ success: true });
    });
});

// 控制信号灯
app.post('/api/control-signal', authenticateToken, checkAdmin, (req, res) => {
    const { action } = req.body;
    if (!action) {
        return res.status(400).json({ error: '缺少动作参数' });
    }

    // 调用 Python 脚本控制信号灯
    exec(`python3 sumo_controller.py --action=${action}`, (error, stdout, stderr) => {
        if (error) {
            console.error('Python 脚本错误:', stderr);
            return res.status(500).json({ error: '控制失败' });
        }
        res.json({ success: true });
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`后端运行中：http://localhost:${PORT}`);
});