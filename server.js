const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;//没跨域

// 配置中间件
app.use(cors());
app.use(bodyParser.json());
// 处理静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 数据库连接
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'MathResources'
});

db.connect(err => {
    if (err) {
        console.error('数据库连接失败:', err);
        return;
    }
    console.log('数据库连接成功');
});

// 注册
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (email, password) VALUES (?, ?)';
        db.query(sql, [email, hashedPassword], (error, results) => {
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
    db.query(sql, [email], async (error, results) => {
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
        const token = jwt.sign({ userId: user.id }, '25f752e4df71b0be1a59d89eae9807c142763538faff548ab092ed6477339dbb', { expiresIn: '1h' });
        res.json({ token });
    });
});
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

    // 执行数据库查询
    db.query(sql, params, (error, results) => {
        if (error) {
            return res.status(500).json({ error: '查询失败' });
        }
        res.json(results);
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`后端运行中：http://localhost:${PORT}`);
});