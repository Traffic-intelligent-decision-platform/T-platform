const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');

// 创建 Express 应用实例
const app = express();
// 创建 HTTP 服务器
const server = require('http').createServer(app);
// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 服务器端口
const PORT = 3000;

// 配置中间件
// 允许跨域请求
app.use(cors());
// 解析 JSON 格式的请求体
app.use(bodyParser.json());
// 静态文件服务，指定静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 数据库连接池配置
const pool = mysql.createPool({
    // 数据库主机地址
    host: 'localhost',
    // 数据库用户名
    user: 'root',
    // 数据库密码
    password: '123456',
    // 数据库名
    database: 'mathresources',
    // 等待连接时是否排队
    waitForConnections: true,
    // 最大连接数
    connectionLimit: 10,
    // 队列最大长度
    queueLimit: 0
});

// WebSocket 连接处理
wss.on('connection', (ws) => {
    console.log('新的 WebSocket 连接');
    const interval = setInterval(() => {
        // 从数据库中查询最新的交通数据
        pool.query('SELECT timestamp, vehicle_count FROM traffic_data ORDER BY timestamp DESC LIMIT 1', (error, results) => {
            if (error) {
                console.error('数据库查询错误:', error);
                return;
            }
            if (results.length > 0) {
                const data = {
                    timestamp: results[0].timestamp,
                    vehicle_count: results[0].vehicle_count
                };
                ws.send(JSON.stringify(data));
            }
        });
    }, 5000);

    ws.on('close', () => {
        console.log('WebSocket 连接关闭');
        clearInterval(interval);
    });
});
// 注册接口
app.post('/api/register', async (req, res) => {
    // 从请求体中获取邮箱和密码
    const { email, password } = req.body;
    try {
        // 对密码进行加密处理
        const hashedPassword = await bcrypt.hash(password, 10);
        // SQL 插入语句，将用户信息插入到 users 表中
        const sql = 'INSERT INTO users (email, password, role) VALUES (?,?,?)';
        // 执行 SQL 语句
        pool.query(sql, [email, hashedPassword, 'user'], (error, results) => {
            if (error) {
                // 如果邮箱已存在，返回 400 错误
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: '该邮箱已被注册' });
                }
                // 其他错误返回 500 错误
                return res.status(500).json({ message: '注册失败' });
            }
            // 注册成功返回 201 状态码和成功信息
            res.status(201).json({ message: '注册成功' });
        });
    } catch (error) {
        // 异常处理，返回 500 错误
        res.status(500).json({ message: '注册失败' });
    }
});

// 登录接口
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT id, email, role, password FROM users WHERE email =?';
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
        // 返回包含token和role的数据
        res.json({ token, role: user.role });
    });
});

// JWT 认证中间件
const authenticateToken = (req, res, next) => {
    // 从请求头中获取认证信息
    const authHeader = req.headers['authorization'];
    // 提取 token
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        // 未提供 token 返回 401 错误
        return res.status(401).json({ error: '未授权' });
    }

    // 验证 token
    jwt.verify(token, '25f752e4df71b0be1a59d89eae9807c142763538faff548ab092ed6477339dbb', (err, user) => {
        if (err) {
            // token 无效返回 403 错误
            return res.status(403).json({ error: 'Token 无效' });
        }
        // 将用户信息添加到请求对象中
        req.user = user;
        // 继续处理下一个中间件或路由
        next();
    });
};

// 管理员权限校验中间件
const checkAdmin = (req, res, next) => {
    // SQL 查询语句，根据用户 ID 查询用户角色
    pool.query(
        'SELECT role FROM users WHERE id=?',
        [req.user.userId],
        (err, results) => {
            if (err || results.length === 0) {
                // 查询出错或未找到用户返回 403 错误
                return res.status(403).json({
                    code: 'AUTH_FAILED',
                    detail: '权限验证失败'
                });
            }
            if (results[0].role!== 'admin') {
                // 不是管理员返回 403 错误
                return res.status(403).json({
                    code: 'ADMIN_REQUIRED',
                    detail: `需要管理员权限（当前角色：${results[0].role}）`
                });
            }
            // 权限验证通过，继续处理下一个中间件或路由
            next();
        }
    );
};

// 合并后的控制信号灯接口
app.post('/api/control-signal', authenticateToken, checkAdmin, (req, res) => {
    // 从请求体中获取动作和路口信息
    const { action, intersection } = req.body;
    // 检查动作是否合法
    if (!['red', 'green', 'yellow'].includes(action)) {
        return res.status(400).json({
            code: 'INVALID_ACTION',
            valid_actions: ['red', 'green', 'yellow']
        });
    }

    // 带重试机制的指令执行函数
    const executeCommand = (retryCount = 0) => {
        // 执行 Python 脚本控制信号灯
        exec(`python3 sumo_controller.py  --action=${action}`, (error, stdout, stderr) => {
            if (error && retryCount < 3) {
                // 执行出错且重试次数小于 3 次，进行重试
                console.log(` 第${retryCount + 1}次重试...`);
                setTimeout(() => executeCommand(retryCount + 1), 1000);
                return;
            }

            if (error) {
                // 最终执行失败，记录错误信息并返回 500 错误
                console.error(' 最终执行失败:', stderr);
                return res.status(500).json({
                    code: 'CONTROL_FAILED',
                    detail: stderr.toString()
                });
            }

            // 广播状态变更
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    // 向所有连接的客户端发送信号灯状态变更信息
                    client.send(JSON.stringify({
                        type: 'PHASE_CHANGE',
                        color: action,
                        duration: action === 'green'? 45 : action === 'red'? 30 : 5
                    }));
                }
            });

            // 返回成功响应，包含信号灯状态、持续时间和下一次变更时间
            res.json({
                status: 'success',
                phase: action,
                duration: action === 'green'? 45 : action === 'red'? 30 : 5,
                next_change: new Date(Date.now() + (action === 'green'? 45000 : 30000))
            });
        });
    };

    // 开始执行命令
    executeCommand();
});

// 处理搜索请求
app.get('/api/resources', (req, res) => {
    // 从请求查询参数中获取搜索关键词和分类
    const { query, category } = req.query;
    // 初始化 SQL 查询语句
    let sql = 'SELECT * FROM resources WHERE 1=1';
    // 初始化查询参数数组
    const params = [];

    // 如果有搜索关键词，添加到 SQL 查询条件中
    if (query) {
        sql += ' AND (title LIKE? OR description LIKE?)';
        params.push(`%${query}%`, `%${query}%`);
    }
    // 如果有分类，添加到 SQL 查询条件中
    if (category) {
        sql += ' AND category =?';
        params.push(category);
    }

    // 执行 SQL 查询
    pool.query(sql, params, (error, results) => {
        if (error) {
            // 查询出错返回 500 错误
            return res.status(500).json({ error: '查询失败' });
        }
        // 返回查询结果
        res.json(results);
    });
});

// 管理员专属路由，获取所有资源信息
app.get('/api/admin/resources', authenticateToken, checkAdmin, (req, res) => {
    // SQL 查询语句，查询所有资源信息
    const sql = 'SELECT * FROM resources';
    // 执行 SQL 查询
    pool.query(sql, (error, results) => {
        if (error) {
            // 查询出错返回 500 错误
            return res.status(500).json({ error: '查询失败' });
        }
        // 返回查询结果
        res.json(results);
    });
});

// 获取交通数据
app.get('/api/traffic-data', (req, res) => {
    // SQL 查询语句，查询最新的 100 条交通数据
    const sql = 'SELECT * FROM traffic_data ORDER BY timestamp DESC LIMIT 100';
    // 执行 SQL 查询
    pool.query(sql, (err, results) => {
        if (err) {
            // 查询出错返回 500 错误
            return res.status(500).json({ error: '查询失败' });
        }
        // 返回查询结果
        res.json(results);
    });
});

// 新增的用于存储交通数据的接口
app.post('/api/traffic-data', (req, res) => {
    // 从请求体中获取路口 ID 和车流量
    const { intersection_id, vehicle_count } = req.body;

    // 检查参数是否合法
    if (!intersection_id || isNaN(vehicle_count)) {
        // 参数格式错误返回 400 错误
        return res.status(400).json({ error: '参数格式错误' });
    }

    // SQL 插入语句，将交通数据插入到 traffic_data 表中
    const sql = 'INSERT INTO traffic_data (intersection_id, vehicle_count) VALUES (?,?)';
    // 执行 SQL 插入操作
    pool.query(sql, [intersection_id, vehicle_count], (err) => {
        if (err) {
            // 数据库写入失败记录错误信息并返回 500 错误
            console.error(' 数据库写入失败:', err);
            return res.status(500).json({ error: '数据存储失败' });
        }
        // 存储成功返回成功信息
        res.json({ success: true });
    });
});

// 启动服务器
server.listen(PORT, () => {
    // 打印服务器启动信息
    console.log(`后端运行中：http://localhost:${PORT}`);
});